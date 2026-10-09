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
      <select
        aria-label={`Map column ${header}`}
        className="rounded border bg-background px-2 py-1"
        id={id}
        onChange={handleChange}
        value={mapping}
      >
        <option value={skipColumnMapping}>Skip column</option>
        <option value={recordIdMapping}>Record ID</option>
        {(recordTableFieldsByType[recordType] as readonly string[]).map(
          (field) => (
            <option key={field} value={field}>
              {fieldLabels[field as RecordTableField]}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

interface PasteCorrectionFieldProps {
  correctionDrafts: Record<string, string>;
  currentValue: string;
  field: string;
  onChange: (key: string, value: string) => void;
  recordType: RecordTableType;
  rowIndex: number;
}

function PasteCorrectionField({
  correctionDrafts,
  currentValue,
  field,
  onChange,
  recordType,
  rowIndex,
}: PasteCorrectionFieldProps) {
  const label = fieldLabels[field as RecordTableField];
  const key = `${rowIndex}:${field}`;
  const value = correctionDrafts[key] ?? currentValue;
  const choices = fieldOptions(recordType, field);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      onChange(key, event.target.value),
    [key, onChange],
  );
  return (
    <label
      className="flex flex-wrap items-center gap-2"
      htmlFor={`record-table-correction-${rowIndex}-${field}`}
    >
      <span>{label}</span>
      {choices ? (
        <select
          aria-label={`Correct ${label} in row ${rowIndex + 1}`}
          className="rounded border bg-background px-2 py-1"
          id={`record-table-correction-${rowIndex}-${field}`}
          onChange={handleChange}
          value={value}
        >
          <option value="">Select a value</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label={`Correct ${label} in row ${rowIndex + 1}`}
          className="min-w-40 rounded border bg-background px-2 py-1"
          id={`record-table-correction-${rowIndex}-${field}`}
          onChange={handleChange}
          value={value}
        />
      )}
    </label>
  );
}

interface PasteReviewItemProps {
  correctionDrafts: Record<string, string>;
  onCorrectionDraftChange: (key: string, value: string) => void;
  onCorrectRow: (rowIndex: number) => void;
  onToggleRow: (rowIndex: number, included: boolean) => void;
  recordType: RecordTableType;
  row: PasteRowReview;
}

function PasteReviewItem({
  correctionDrafts,
  onCorrectionDraftChange,
  onCorrectRow,
  onToggleRow,
  recordType,
  row,
}: PasteReviewItemProps) {
  const handleCorrect = useCallback(
    () => onCorrectRow(row.index),
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
      <div className="space-y-2">
        {Object.entries(row.fields).map(([field, value]) => (
          <PasteCorrectionField
            correctionDrafts={correctionDrafts}
            currentValue={displayValue(value)}
            field={field}
            key={field}
            onChange={onCorrectionDraftChange}
            recordType={recordType}
            rowIndex={row.index}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border px-2 py-1"
          onClick={handleCorrect}
          type="button"
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
    className: "min-w-32 rounded border bg-background px-2 py-1",
    disabled: !editable,
    onBlur: handleBlur,
    onChange: handleValueChange,
    value,
  };
  let control: ReactNode;
  if (choices) {
    control = (
      <select
        aria-label={label}
        className={commonProps.className}
        disabled={!(editable && hasCurrentChoice)}
        onChange={handleChoiceChange}
        value={choices.includes(value) ? value : currentChoice}
      >
        {hasCurrentChoice ? null : (
          <option disabled value={currentChoice}>
            {currentChoice}
          </option>
        )}
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    );
  } else if (multiLineRecordTableFields.has(field)) {
    control = <textarea {...commonProps} rows={1} />;
  } else {
    control = <input {...commonProps} type={inputTypeForField(field)} />;
  }

  return (
    <div className="min-w-36">
      {control}
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

function RecordTableGrid({
  onSaveCell,
  recordType,
  records,
}: Pick<RecordTableViewProps, "onSaveCell" | "recordType" | "records">) {
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

  return (
    <div className="space-y-3">
      <label className="block space-y-1" htmlFor="record-table-filter">
        <span>Filter rows</span>
        <input
          aria-label="Filter rows"
          className="w-full rounded border bg-background px-3 py-2"
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
  const [pasteText, setPasteText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnIds, setColumnIds] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [rowIds, setRowIds] = useState<string[]>([]);
  const [mappings, setMappings] = useState<string[]>([]);
  const [createRecordIds, setCreateRecordIds] = useState<string[]>([]);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [correctionDrafts, setCorrectionDrafts] = useState<
    Record<string, string>
  >({});
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

  const reviewPaste = useCallback(() => {
    const parsed = parseTsv(pasteText);
    setHeaders(parsed.headers);
    setRawRows(parsed.rows);
    setColumnIds(parsed.headers.map(() => crypto.randomUUID()));
    setRowIds(parsed.rows.map(() => crypto.randomUUID()));
    setMappings(
      parsed.headers.map((header) => suggestedMapping(header, recordType)),
    );
    setCreateRecordIds(
      parsed.rows.map(() => (recordType === "Work" ? "" : crypto.randomUUID())),
    );
    setCorrections({});
    setCorrectionDrafts({});
    setExcludedRows(new Set());
    setPasteError(
      parsed.headers.length && parsed.rows.length
        ? ""
        : "Paste a header row and at least one data row.",
    );
    setPasteMessage("");
  }, [pasteText, recordType]);

  const correctRow = useCallback(
    (index: number) => {
      setCorrections((previous) => {
        const next = { ...previous };
        for (const [key, value] of Object.entries(correctionDrafts)) {
          if (key.startsWith(`${index}:`)) {
            next[key] = value;
          }
        }
        return next;
      });
    },
    [correctionDrafts],
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

  const handleCorrectionDraftChange = useCallback(
    (key: string, value: string) => {
      setCorrectionDrafts((previous) => ({ ...previous, [key]: value }));
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
      setPasteText("");
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

  const handlePasteTextChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) =>
      setPasteText(event.target.value),
    [],
  );

  return (
    <section aria-label="Table" className="space-y-4">
      <h3 className="font-medium">Table</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1" htmlFor="record-table-type">
          <span>Type</span>
          <select
            className="rounded border bg-background px-3 py-2"
            id="record-table-type"
            onChange={handleTypeChange}
            value={recordType}
          >
            {recordTableTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1" htmlFor="record-table-project">
          <span>Project</span>
          <select
            className="rounded border bg-background px-3 py-2"
            id="record-table-project"
            onChange={handleProjectChange}
            value={projectId}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {failed ? <p role="alert">Table is unavailable.</p> : null}
      {pending ? <p role="status">Loading…</p> : null}
      {failed || pending ? null : (
        <RecordTableGrid
          onSaveCell={onSaveCell}
          records={records}
          recordType={recordType}
        />
      )}
      <details className="rounded border p-3">
        <summary className="cursor-pointer font-medium">Paste rows</summary>
        <div className="mt-3 space-y-3">
          <label className="block space-y-1" htmlFor="record-table-paste">
            <span>Paste rows</span>
            <textarea
              aria-label="Paste rows"
              className="min-h-28 w-full rounded border bg-background px-3 py-2 font-mono text-sm"
              id="record-table-paste"
              onChange={handlePasteTextChange}
              placeholder="Title&#9;Decision&#10;Launch timing&#9;Ship in June"
              value={pasteText}
            />
          </label>
          <button
            className="rounded border px-3 py-2"
            onClick={reviewPaste}
            type="button"
          >
            Preview paste
          </button>
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
                    correctionDrafts={correctionDrafts}
                    key={row.id}
                    onCorrectionDraftChange={handleCorrectionDraftChange}
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
