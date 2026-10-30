import { EXPORT_MAX_CROSS_PROJECTS } from "@cantiara/api/data-export";
import {
  parseRecordTableFieldValue,
  type RecordTableCellUpdateInput,
  type RecordTableField,
  type RecordTablePasteInput,
  type RecordTableRecord,
  recordTableFieldOptionsByType,
  recordTableFieldsByType,
  recordTablePasteInputSchema,
  recordTableTypes,
} from "@cantiara/api/record-discovery";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { ExportListAction } from "@/components/export-list-action";
import {
  type ExportHandoff,
  groupRecordIdsByType,
  scopeForProjects,
} from "@/features/data-export/lib/export-handoff";
import RecordTablePasteCorrectionForm, {
  recordTablePasteCorrectionFormId,
} from "../forms/record-table-paste-correction-form";
import RecordTablePasteForm from "../forms/record-table-paste-form";

const fieldLabels = {
  answer: "Answer",
  context: "Context",
  decision: "Decision",
  description: "Description",
  detectedHow: "Detected how",
  effort: "Effort",
  impact: "Impact",
  learning: "Learning",
  life: "Life",
  name: "Name",
  occurredAt: "Occurred at",
  plannedStartDate: "Planned start date",
  probability: "Probability",
  question: "Question",
  rationale: "Rationale",
  resolution: "Resolution",
  response: "Response",
  rootCause: "Root cause",
  statement: "Statement",
  status: "Status",
  targetDate: "Target date",
  title: "Title",
  versionLabel: "Version label",
} satisfies Record<RecordTableField, string>;

const recordIdMapping = "$recordId";
const skipColumnMapping = "$skip";

type RecordTableType = (typeof recordTableTypes)[number];
interface RecordTableProject {
  id: string;
  name: string;
}
type RecordTablePasteRow = RecordTablePasteInput["rows"][number];
interface PasteRowReview {
  candidate: RecordTablePasteRow | null;
  error: string | null;
  fields: Record<string, unknown>;
  id: string;
  included: boolean;
  index: number;
  kind: "create" | "update";
}

export interface RecordTableViewProps {
  failed?: boolean;
  onApplyPaste: (input: RecordTablePasteInput) => Promise<void>;
  onProjectChange: (projectId: string) => void;
  onRecordTypeChange: (recordType: RecordTableType) => void;
  onSaveCell: (input: RecordTableCellUpdateInput) => Promise<void>;
  pending?: boolean;
  projectId: string;
  projects: RecordTableProject[];
  records: RecordTableRecord[];
  recordType: RecordTableType;
}

function recordField(record: RecordTableRecord, field: string): unknown {
  return (record as unknown as Record<string, unknown>)[field];
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowTitle(record: RecordTableRecord) {
  const values = record as unknown as Record<string, unknown>;
  return displayValue(values.title ?? values.name ?? record.id);
}

function fieldOptions(recordType: RecordTableType, field: string) {
  return (
    recordTableFieldOptionsByType[recordType] as Record<
      string,
      readonly string[] | undefined
    >
  )[field];
}

function editableChoices(
  recordType: RecordTableType,
  field: string,
  currentValue: unknown,
) {
  const choices = fieldOptions(recordType, field);
  if (
    recordType === "Milestone" &&
    field === "status" &&
    currentValue !== "Planned"
  ) {
    return [];
  }
  return choices;
}

function parseTsv(text: string) {
  const lines = text
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return { headers: [] as string[], rows: [] as string[][] };
  }
  return {
    headers: lines[0]?.split("\t") ?? [],
    rows: lines.slice(1).map((line) => line.split("\t")),
  };
}

function suggestedMapping(header: string, recordType: RecordTableType) {
  const trimmed = header.trim();
  if (trimmed.toLocaleLowerCase() === "record id") {
    return recordIdMapping;
  }
  const fields = recordTableFieldsByType[recordType] as readonly string[];
  return (
    fields.find(
      (field) =>
        field.toLocaleLowerCase() === trimmed.toLocaleLowerCase() ||
        fieldLabels[field as RecordTableField]?.toLocaleLowerCase() ===
          trimmed.toLocaleLowerCase(),
    ) ?? skipColumnMapping
  );
}

interface PasteReviewInput {
  corrections: Record<string, string>;
  createRecordIds: string[];
  excludedRows: Set<number>;
  mappings: string[];
  projectId: string;
  rawRows: string[][];
  records: RecordTableRecord[];
  recordType: RecordTableType;
  rowIds: string[];
}

function parsePasteValue(
  recordType: RecordTableType,
  field: string,
  value: string,
) {
  try {
    return parseRecordTableFieldValue(recordType, field, value);
  } catch {
    return value;
  }
}

function mapPasteFields({
  corrections,
  index,
  mappings,
  rawRow,
  recordType,
}: Pick<PasteReviewInput, "corrections" | "mappings" | "recordType"> & {
  index: number;
  rawRow: string[];
}) {
  const fields: Record<string, unknown> = {};
  let recordId = "";
  for (const [columnIndex, mapping] of mappings.entries()) {
    const value = rawRow[columnIndex] ?? "";
    if (mapping === recordIdMapping) {
      recordId = value.trim();
      continue;
    }
    if (!mapping || mapping === skipColumnMapping) {
      continue;
    }
    const correctionKey = `${index}:${mapping}`;
    const correctedValue = corrections[correctionKey] ?? value;
    fields[mapping] = parsePasteValue(recordType, mapping, correctedValue);
  }
  return { fields, recordId };
}

function findDuplicateField(mappings: string[]) {
  const fields = mappings.filter(
    (mapping) => mapping !== recordIdMapping && mapping !== skipColumnMapping,
  );
  return fields.find((field, index) => fields.indexOf(field) !== index);
}

function createPasteCandidate({
  createRecordIds,
  duplicateField,
  fields,
  index,
  projectId,
  recordId,
  recordType,
  records,
}: Pick<
  PasteReviewInput,
  "createRecordIds" | "projectId" | "recordType" | "records"
> & {
  duplicateField: string | undefined;
  fields: Record<string, unknown>;
  index: number;
  recordId: string;
}): { candidate: RecordTablePasteRow | null; error: string | null } {
  const currentRecord = recordId
    ? records.find((record) => record.id === recordId)
    : undefined;
  if (duplicateField) {
    return {
      candidate: null,
      error: `Map a column to ${fieldLabels[duplicateField as RecordTableField]} only once.`,
    };
  }
  if (recordId && !currentRecord) {
    return {
      candidate: null,
      error: "Record ID must match a row in this Table.",
    };
  }
  const rowProjectId = currentRecord?.projectId ?? projectId;
  if (!rowProjectId) {
    return {
      candidate: null,
      error: "Select a Project before creating rows.",
    };
  }
  const candidate: RecordTablePasteRow = currentRecord
    ? {
        baseRevision: currentRecord.revision,
        fields,
        kind: "update",
        projectId: rowProjectId,
        recordId: currentRecord.id,
      }
    : {
        fields,
        kind: "create",
        projectId: rowProjectId,
        ...(recordType === "Work"
          ? {}
          : { recordId: createRecordIds[index] ?? crypto.randomUUID() }),
      };
  const parsed = recordTablePasteInputSchema.safeParse({
    clientIdempotencyKey: "record-table-preview",
    recordType,
    rows: [candidate],
  });
  return {
    candidate,
    error: parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? "Review this row's values."),
  };
}

function createPasteReviewRow(
  input: PasteReviewInput,
  rawRow: string[],
  index: number,
): PasteRowReview {
  const { fields, recordId } = mapPasteFields({
    corrections: input.corrections,
    index,
    mappings: input.mappings,
    rawRow,
    recordType: input.recordType,
  });
  const { candidate, error } = createPasteCandidate({
    ...input,
    duplicateField: findDuplicateField(input.mappings),
    fields,
    index,
    recordId,
  });
  return {
    candidate,
    error,
    fields,
    id: input.rowIds[index] ?? `${index}:${rawRow.join("\t")}`,
    index,
    included: !input.excludedRows.has(index),
    kind: recordId ? "update" : "create",
  };
}

function createPasteReviewRows(input: PasteReviewInput): PasteRowReview[] {
  return input.rawRows.map((rawRow, index) =>
    createPasteReviewRow(input, rawRow, index),
  );
}

function inputTypeForField(field: RecordTableField) {
  return field === "targetDate" || field === "plannedStartDate"
    ? "date"
    : "text";
}

const multiLineRecordTableFields = new Set<RecordTableField>([
  "answer",
  "context",
  "decision",
  "description",
  "detectedHow",
  "impact",
  "learning",
  "question",
  "rationale",
  "resolution",
  "response",
  "rootCause",
  "statement",
]);

interface ColumnMappingProps {
  columnIndex: number;
  header: string;
  id: string;
  mapping: string;
  onChange: (columnIndex: number, value: string) => void;
  recordType: RecordTableType;
}

function ColumnMapping({
  id,
  columnIndex,
  header,
  mapping,
  onChange,
  recordType,
}: ColumnMappingProps) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      onChange(columnIndex, event.target.value),
    [columnIndex, onChange],
  );
  return (
    <label className="flex flex-wrap items-center gap-2" htmlFor={id}>
      <span>{header}</span>
      <NativeSelect
        aria-label={`Map column ${header}`}
        id={id}
        onChange={handleChange}
        value={mapping}
      >
        <NativeSelectOption value={skipColumnMapping}>
          Skip column
        </NativeSelectOption>
        <NativeSelectOption value={recordIdMapping}>
          Record ID
        </NativeSelectOption>
        {(recordTableFieldsByType[recordType] as readonly string[]).map(
          (field) => (
            <NativeSelectOption key={field} value={field}>
              {fieldLabels[field as RecordTableField]}
            </NativeSelectOption>
          ),
        )}
      </NativeSelect>
    </label>
  );
}

interface PasteReviewItemProps {
  onCorrectRow: (rowIndex: number, values: Record<string, string>) => void;
  onToggleRow: (rowIndex: number, included: boolean) => void;
  recordType: RecordTableType;
  row: PasteRowReview;
}

function PasteReviewItem({
  onCorrectRow,
  onToggleRow,
  recordType,
  row,
}: PasteReviewItemProps) {
  const handleCorrect = useCallback(
    (values: Record<string, string>) => onCorrectRow(row.index, values),
    [onCorrectRow, row.index],
  );
  const handleToggle = useCallback(
    () => onToggleRow(row.index, row.included),
    [onToggleRow, row.included, row.index],
  );
  return (
    <li
      className="space-y-2 rounded border p-3"
      data-invalid={Boolean(row.error)}
    >
      <p>
        Row {row.index + 1} · {row.kind === "create" ? "Create" : "Update"}
        {row.error ? <span role="alert"> · {row.error}</span> : null}
      </p>
      <RecordTablePasteCorrectionForm
        fields={Object.entries(row.fields).map(([field, value]) => ({
          choices: fieldOptions(recordType, field),
          currentValue: displayValue(value),
          field,
          label: fieldLabels[field as RecordTableField],
        }))}
        onCorrect={handleCorrect}
        rowIndex={row.index}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-2 py-1"
          form={recordTablePasteCorrectionFormId(row.index)}
          type="submit"
        >
          Correct row
        </button>
        <button
          className="rounded border px-2 py-1"
          onClick={handleToggle}
          type="button"
        >
          {row.included ? "Exclude row" : "Include row"}
        </button>
      </div>
    </li>
  );
}

function EditableCell({
  field,
  onSave,
  record,
  recordType,
}: {
  field: RecordTableField;
  onSave: RecordTableViewProps["onSaveCell"];
  record: RecordTableRecord;
  recordType: RecordTableType;
}) {
  const currentValue = recordField(record, field);
  const [value, setValue] = useState(displayValue(currentValue));
  const [error, setError] = useState("");
  const choices = editableChoices(recordType, field, currentValue);
  const currentChoice = displayValue(currentValue);
  const hasCurrentChoice = choices?.includes(currentChoice) ?? true;
  const title = rowTitle(record);
  const editable = !(
    (recordType === "Work" &&
      field === "status" &&
      currentValue === "Closed") ||
    ("sourceType" in record &&
      record.sourceType === "Decision" &&
      record.life === "Superseded")
  );
  const save = useCallback(
    async (nextValue = value) => {
      if (!editable || nextValue === displayValue(currentValue)) {
        return;
      }
      try {
        const parsedValue = parseRecordTableFieldValue(
          recordType,
          field,
          nextValue,
        );
        await onSave({
          baseRevision: record.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          field,
          projectId: record.projectId,
          recordId: record.id,
          recordType,
          value: parsedValue,
        });
        setError("");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save this cell.",
        );
      }
    },
    [currentValue, editable, field, onSave, record, recordType, value],
  );
  const handleBlur = useCallback(() => save(), [save]);
  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValue(event.target.value),
    [],
  );
  const handleChoiceChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setValue(nextValue);
      await save(nextValue);
    },
    [save],
  );
  const label = `Edit ${fieldLabels[field]} for ${title}`;
  const commonProps = {
    "aria-label": label,
    className: "min-w-32",
    disabled: !editable,
    onBlur: handleBlur,
    onChange: handleValueChange,
    value,
  };
  let control: ReactNode;
  if (choices) {
    control = (
      <NativeSelect
        aria-label={label}
        className={commonProps.className}
        disabled={!(editable && hasCurrentChoice)}
        onChange={handleChoiceChange}
        value={choices.includes(value) ? value : currentChoice}
      >
        {hasCurrentChoice ? null : (
          <NativeSelectOption disabled value={currentChoice}>
            {currentChoice}
          </NativeSelectOption>
        )}
        {choices.map((choice) => (
          <NativeSelectOption key={choice} value={choice}>
            {choice}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  } else if (multiLineRecordTableFields.has(field)) {
    control = <Textarea {...commonProps} rows={1} />;
  } else {
    control = <Input {...commonProps} type={inputTypeForField(field)} />;
  }

  return (
    <div className="min-w-36">
      {control}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

function RecordTableGrid({
  exportProjectIds,
  onSaveCell,
  recordType,
  records,
}: Pick<RecordTableViewProps, "onSaveCell" | "recordType" | "records"> & {
  /** The Projects this table lists; Work can be exported from them. */
  exportProjectIds: readonly string[];
}) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const handleFilterChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFilter(event.target.value),
    [],
  );
  const fields = recordTableFieldsByType[
    recordType
  ] as readonly RecordTableField[];
  const columns = useMemo<ColumnDef<RecordTableRecord, unknown>[]>(
    () =>
      fields.map((field) => ({
        accessorFn: (record) => recordField(record, field),
        cell: ({ row }) => (
          <EditableCell
            field={field}
            key={`${row.id}:${field}:${row.original.revision}`}
            onSave={onSaveCell}
            record={row.original}
            recordType={recordType}
          />
        ),
        header: ({ column }) => (
          <button
            aria-label={`Sort by ${fieldLabels[field]}`}
            className="font-medium underline-offset-2 hover:underline"
            onClick={column.getToggleSortingHandler()}
            type="button"
          >
            {fieldLabels[field]}
            {column.getIsSorted() === "asc" ? " ↑" : ""}
            {column.getIsSorted() === "desc" ? " ↓" : ""}
          </button>
        ),
        id: field,
      })),
    [fields, onSaveCell, recordType],
  );
  const typedRecords = useMemo(
    () =>
      records.filter((record) =>
        recordType === "Work"
          ? !("sourceType" in record)
          : "sourceType" in record && record.sourceType === recordType,
      ),
    [recordType, records],
  );
  const table = useReactTable({
    columns,
    data: typedRecords,
    enableGlobalFilter: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (record) => `${record.projectId}:${record.id}`,
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    onGlobalFilterChange: setFilter,
    onSortingChange: setSorting,
    state: { globalFilter: filter, sorting },
  });

  // The rows as shown: filtered and sorted, mixed Work types in one list.
  const shownRows = table.getRowModel().rows;
  const describeExport = useCallback((): ExportHandoff => {
    const shown = shownRows.map((row) => ({
      id: row.original.id,
      type: String(recordField(row.original, "type")),
    }));
    const [onlyProject] = exportProjectIds;
    return {
      filters: {},
      listedIds: shown.map((work) => work.id),
      recordIdsByType: groupRecordIdsByType(shown),
      scope: scopeForProjects(exportProjectIds),
      view: {
        kind:
          exportProjectIds.length === 1 && onlyProject
            ? "Work list"
            : "Cross-project list",
        name: "Work table",
        order: "listed",
      },
      visibleFields: [...fields],
    };
  }, [exportProjectIds, fields, shownRows]);
  const canExport =
    recordType === "Work" &&
    shownRows.length > 0 &&
    exportProjectIds.length > 0 &&
    exportProjectIds.length <= EXPORT_MAX_CROSS_PROJECTS;

  return (
    <div className="space-y-3">
      {canExport ? (
        <ExportListAction describe={describeExport} label="Work table" />
      ) : null}
      <label className="block space-y-1" htmlFor="record-table-filter">
        <span>Filter rows</span>
        <Input
          aria-label="Filter rows"
          id="record-table-filter"
          onChange={handleFilterChange}
          type="search"
          value={filter}
        />
      </label>
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                className="border-b bg-muted/40 text-left"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => (
                  <th className="px-3 py-2" key={header.id} scope="col">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-b last:border-0" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="px-3 py-2 align-top" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length ? null : (
              <tr>
                <td
                  className="px-3 py-6 text-center text-muted-foreground"
                  colSpan={fields.length}
                >
                  No matching records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RecordTableView({
  failed = false,
  onApplyPaste,
  onProjectChange,
  onRecordTypeChange,
  onSaveCell,
  pending = false,
  projectId,
  projects,
  recordType,
  records,
}: RecordTableViewProps) {
  const pasteIdempotencyKeys = useRef(new Map<string, string>());
  const [pasteFormKey, setPasteFormKey] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [rowIds, setRowIds] = useState<string[]>([]);
  const [mappings, setMappings] = useState<string[]>([]);
  const [createRecordIds, setCreateRecordIds] = useState<string[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [pasteError, setPasteError] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [pastePending, setPastePending] = useState(false);
  const rows = useMemo(
    () =>
      createPasteReviewRows({
        corrections,
        createRecordIds,
        excludedRows,
        mappings,
        projectId,
        rawRows,
        recordType,
        records,
        rowIds,
      }),
    [
      corrections,
      createRecordIds,
      excludedRows,
      mappings,
      projectId,
      rawRows,
      recordType,
      records,
      rowIds,
    ],
  );
  const canApply =
    rows.some((row) => row.included && row.candidate && !row.error) &&
    rows.every(
      (row) => !row.included || (row.candidate !== null && !row.error),
    );

  const reviewPaste = useCallback(
    (pasteText: string) => {
      const parsed = parseTsv(pasteText);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setColumnIds(parsed.headers.map(() => crypto.randomUUID()));
      setRowIds(parsed.rows.map(() => crypto.randomUUID()));
      setMappings(
        parsed.headers.map((header) => suggestedMapping(header, recordType)),
      );
      setCreateRecordIds(
        parsed.rows.map(() =>
          recordType === "Work" ? "" : crypto.randomUUID(),
        ),
      );
      setCorrections({});
      setExcludedRows(new Set());
      setPasteError(
        parsed.headers.length && parsed.rows.length
          ? ""
          : "Paste a header row and at least one data row.",
      );
      setPasteMessage("");
    },
    [recordType],
  );

  const correctRow = useCallback(
    (index: number, values: Record<string, string>) => {
      setCorrections((previous) => {
        const next = { ...previous };
        for (const [field, value] of Object.entries(values)) {
          next[`${index}:${field}`] = value;
        }
        return next;
      });
    },
    [],
  );

  const handleMappingChange = useCallback(
    (columnIndex: number, value: string) => {
      setMappings((previous) =>
        previous.map((mapping, index) =>
          index === columnIndex ? value : mapping,
        ),
      );
    },
    [],
  );

  const toggleRow = useCallback((rowIndex: number, included: boolean) => {
    setExcludedRows((previous) => {
      const next = new Set(previous);
      if (included) {
        next.add(rowIndex);
      } else {
        next.delete(rowIndex);
      }
      return next;
    });
  }, []);

  const applyPaste = useCallback(async () => {
    const validRows = rows.flatMap((row) =>
      row.included && row.candidate && !row.error ? [row.candidate] : [],
    );
    const parsed = recordTablePasteInputSchema.safeParse({
      clientIdempotencyKey: "record-table-paste-preview",
      recordType,
      rows: validRows,
    });
    if (!parsed.success) {
      setPasteError(
        parsed.error.issues[0]?.message ?? "Review the selected rows.",
      );
      return;
    }
    const fingerprint = JSON.stringify({
      recordType: parsed.data.recordType,
      rows: parsed.data.rows,
    });
    const clientIdempotencyKey =
      pasteIdempotencyKeys.current.get(fingerprint) ?? crypto.randomUUID();
    pasteIdempotencyKeys.current.set(fingerprint, clientIdempotencyKey);
    setPastePending(true);
    setPasteError("");
    try {
      await onApplyPaste({ ...parsed.data, clientIdempotencyKey });
      pasteIdempotencyKeys.current.delete(fingerprint);
      setPasteFormKey((key) => key + 1);
      setHeaders([]);
      setColumnIds([]);
      setRawRows([]);
      setRowIds([]);
      setMappings([]);
      setPasteMessage("Changes applied.");
    } catch (error) {
      setPasteError(
        error instanceof Error
          ? error.message
          : "Could not apply these changes.",
      );
    } finally {
      setPastePending(false);
    }
  }, [onApplyPaste, recordType, rows]);

  const handleTypeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      onRecordTypeChange(event.target.value as RecordTableType);
    },
    [onRecordTypeChange],
  );

  const handleProjectChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) =>
      onProjectChange(event.target.value),
    [onProjectChange],
  );

  return (
    <section aria-label="Table" className="space-y-4">
      <h3 className="font-medium">Table</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1" htmlFor="record-table-type">
          <span>Type</span>
          <NativeSelect
            id="record-table-type"
            onChange={handleTypeChange}
            value={recordType}
          >
            {recordTableTypes.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {type}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="block space-y-1" htmlFor="record-table-project">
          <span>Project</span>
          <NativeSelect
            id="record-table-project"
            onChange={handleProjectChange}
            value={projectId}
          >
            <NativeSelectOption value="">All Projects</NativeSelectOption>
            {projects.map((project) => (
              <NativeSelectOption key={project.id} value={project.id}>
                {project.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
      {failed ? <p role="alert">Table is unavailable.</p> : null}
      {pending ? <p role="status">Loading…</p> : null}
      {failed || pending ? null : (
        <RecordTableGrid
          exportProjectIds={
            projectId ? [projectId] : projects.map((project) => project.id)
          }
          onSaveCell={onSaveCell}
          records={records}
          recordType={recordType}
        />
      )}
      <details className="rounded border p-3">
        <summary className="cursor-pointer font-medium">Paste rows</summary>
        <div className="mt-3 space-y-3">
          <RecordTablePasteForm key={pasteFormKey} onReview={reviewPaste} />
          {headers.length ? (
            <div className="space-y-2">
              <h4 className="font-medium">Column mapping</h4>
              {headers.map((header, columnIndex) => {
                const columnId =
                  columnIds[columnIndex] ?? `record-table-map-${columnIndex}`;
                return (
                  <ColumnMapping
                    columnIndex={columnIndex}
                    header={header}
                    id={columnId}
                    key={columnId}
                    mapping={mappings[columnIndex] ?? skipColumnMapping}
                    onChange={handleMappingChange}
                    recordType={recordType}
                  />
                );
              })}
            </div>
          ) : null}
          {rows.length ? (
            <div className="space-y-3">
              <h4 className="font-medium">Review paste</h4>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <PasteReviewItem
                    key={row.id}
                    onCorrectRow={correctRow}
                    onToggleRow={toggleRow}
                    recordType={recordType}
                    row={row}
                  />
                ))}
              </ul>
              <button
                className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
                disabled={!canApply || pastePending}
                onClick={applyPaste}
                type="button"
              >
                Apply changes
              </button>
            </div>
          ) : null}
          {pasteError ? <p role="alert">{pasteError}</p> : null}
          {pasteMessage ? <p role="status">{pasteMessage}</p> : null}
          {pastePending ? <p role="status">Applying changes…</p> : null}
        </div>
      </details>
    </section>
  );
}
