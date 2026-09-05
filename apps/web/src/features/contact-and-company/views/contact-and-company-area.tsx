import { Button } from "@cantiara/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { CONTACT_AND_COMPANY_COPY } from "@/features/contact-and-company/forms/contact-and-company-copy";
import CreateCompanyForm from "@/features/contact-and-company/forms/create-company-form";
import CreateContactForm from "@/features/contact-and-company/forms/create-contact-form";
import MergeContactsForm from "@/features/contact-and-company/forms/merge-contacts-form";
import SetContactCompanyForm from "@/features/contact-and-company/forms/set-contact-company-form";
import UndoMergeContactsForm from "@/features/contact-and-company/forms/undo-merge-contacts-form";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { FounderSection } from "@/features/personal-shell/components/founder-surface";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

export default function ContactAndCompanyArea({
	companyId,
	contactId,
}: {
	companyId?: string;
	contactId?: string;
}) {
	const navigate = useNavigate();
	const contacts = useQuery(orpc.contactAndCompany.listContacts.queryOptions());
	const companies = useQuery(
		orpc.contactAndCompany.listCompanies.queryOptions()
	);
	const candidates = useQuery(
		orpc.contactAndCompany.listDuplicateCandidates.queryOptions()
	);
	const contact = useQuery({
		...orpc.contactAndCompany.getContact.queryOptions({
			input: { contactId: contactId ?? "" },
		}),
		enabled: Boolean(contactId),
	});
	const company = useQuery({
		...orpc.contactAndCompany.getCompany.queryOptions({
			input: { companyId: companyId ?? "" },
		}),
		enabled: Boolean(companyId),
	});
	const openContact = useCallback(
		(id: string) => {
			navigate({
				search: { contact: id },
				to: "/contacts",
			}).catch(() => undefined);
		},
		[navigate]
	);
	const openCompany = useCallback(
		(id: string) => {
			navigate({
				search: { company: id },
				to: "/contacts",
			}).catch(() => undefined);
		},
		[navigate]
	);

	if (contacts.isPending || companies.isPending || candidates.isPending) {
		return (
			<FounderPage title={CONTACT_AND_COMPANY_COPY.contact}>
				<p className="flex items-center gap-2 text-muted-foreground text-sm">
					<Spinner />
					{PROJECT_SHELL_COPY.loading}
				</p>
			</FounderPage>
		);
	}
	if (contacts.isError || companies.isError || candidates.isError) {
		return (
			<FounderPage title={CONTACT_AND_COMPANY_COPY.contact}>
				<p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>
			</FounderPage>
		);
	}

	return (
		<FounderPage title={CONTACT_AND_COMPANY_COPY.contact} wide>
			<FounderSection title={CONTACT_AND_COMPANY_COPY.company}>
				<CreateCompanyForm onCreated={openCompany} />
				{companies.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{CONTACT_AND_COMPANY_COPY.noCompanies}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="mt-4 flex flex-col gap-1">
						{companies.data.map((item) => (
							<li key={item.id}>
								<IdentityRow
									label={item.name}
									onSelect={openCompany}
									recordId={item.id}
								/>
							</li>
						))}
					</ul>
				)}
				{company.data ? (
					<article className="mt-4 flex flex-col gap-2">
						<h2 className="font-medium text-sm">{company.data.name}</h2>
					</article>
				) : null}
			</FounderSection>
			<FounderSection title={CONTACT_AND_COMPANY_COPY.duplicateCandidates}>
				{candidates.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>
								{CONTACT_AND_COMPANY_COPY.noDuplicateCandidates}
							</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="mt-4 flex flex-col gap-3">
						{candidates.data.map((item) => (
							<li key={`${item.left.id}:${item.right.id}`}>
								<p className="text-muted-foreground text-xs">
									{item.strength === "strong"
										? item.copy.strongCopyCandidate
										: item.copy.weakSuggestion}
								</p>
								<div className="mt-1 flex flex-wrap gap-1">
									<IdentityRow
										label={item.left.displayName ?? item.left.id}
										onSelect={openContact}
										recordId={item.left.id}
									/>
									<IdentityRow
										label={item.right.displayName ?? item.right.id}
										onSelect={openContact}
										recordId={item.right.id}
									/>
								</div>
							</li>
						))}
					</ul>
				)}
			</FounderSection>
			<FounderSection title={CONTACT_AND_COMPANY_COPY.contact}>
				<CreateContactForm companies={companies.data} onCreated={openContact} />
				{contacts.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{CONTACT_AND_COMPANY_COPY.noContacts}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="mt-4 flex flex-col gap-1">
						{contacts.data.map((item) => (
							<li key={item.id}>
								<IdentityRow
									label={item.displayName ?? item.id}
									onSelect={openContact}
									recordId={item.id}
								/>
							</li>
						))}
					</ul>
				)}
				{contact.data ? (
					<ContactProfile
						companies={companies.data}
						mergeCandidates={strongMergeCandidates(
							candidates.data,
							contact.data.id
						)}
						onOpenCompany={openCompany}
						onOpenContact={openContact}
						profile={contact.data}
					/>
				) : null}
			</FounderSection>
		</FounderPage>
	);
}

function IdentityRow({
	label,
	onSelect,
	recordId,
}: {
	label: string;
	onSelect: (id: string) => void;
	recordId: string;
}) {
	const onClick = useCallback(() => {
		onSelect(recordId);
	}, [onSelect, recordId]);
	return (
		<Button onClick={onClick} type="button" variant="ghost">
			{label}
		</Button>
	);
}

function strongMergeCandidates(
	candidates: Array<{
		left: { displayName: string | null; id: string };
		right: { displayName: string | null; id: string };
		strength: "strong" | "weak";
	}>,
	contactId: string
) {
	return candidates.flatMap((item) => {
		if (item.strength !== "strong") {
			return [];
		}
		if (item.left.id === contactId) {
			return [item.right];
		}
		if (item.right.id === contactId) {
			return [item.left];
		}
		return [];
	});
}

function ContactProfile({
	companies,
	mergeCandidates,
	onOpenCompany,
	onOpenContact,
	profile,
}: {
	companies: Array<{ id: string; name: string }>;
	mergeCandidates: Array<{ displayName: string | null; id: string }>;
	onOpenCompany: (companyId: string) => void;
	onOpenContact: (contactId: string) => void;
	profile: {
		currentCompany: { id: string; name: string } | null;
		displayName: string | null;
		emailAliases: Array<{ originalEmail: string }>;
		id: string;
		latestMergeEventId: string | null;
		origin: { displayName: string | null; id: string } | null;
		relatedFeedback: Array<{
			id: string;
			openSourceRecord: string;
			title: string;
		}>;
		relatedPersonaDocuments: Array<{
			id: string;
			openSourceRecord: string;
			title: string;
		}>;
		retiredIdentities: Array<{ displayName: string | null; id: string }>;
		revision: number;
	};
}) {
	const { currentCompany, displayName, emailAliases } = profile;
	return (
		<article className="mt-6 flex flex-col gap-3">
			<h2 className="font-medium text-sm">
				{displayName ?? CONTACT_AND_COMPANY_COPY.contact}
			</h2>
			{profile.origin ? (
				<p className="text-muted-foreground text-xs">
					{CONTACT_AND_COMPANY_COPY.origin}{" "}
					{profile.origin.displayName ?? profile.origin.id}
				</p>
			) : null}
			{emailAliases.map((alias) => (
				<p className="text-muted-foreground text-sm" key={alias.originalEmail}>
					{alias.originalEmail}
				</p>
			))}
			<SetContactCompanyForm
				companies={companies}
				contactId={profile.id}
				currentCompanyId={currentCompany ? currentCompany.id : null}
				key={`${profile.id}:${profile.revision}`}
				revision={profile.revision}
			/>
			<MergeContactsForm
				candidates={mergeCandidates}
				onMerged={onOpenContact}
				revision={profile.revision}
				survivorId={profile.id}
			/>
			{profile.latestMergeEventId ? (
				<UndoMergeContactsForm
					key={`${profile.id}:undo:${profile.revision}`}
					mergeEventId={profile.latestMergeEventId}
					onUndone={onOpenContact}
					revision={profile.revision}
					survivorId={profile.id}
				/>
			) : null}
			{currentCompany ? (
				<section>
					<h3 className="text-muted-foreground text-xs">
						{CONTACT_AND_COMPANY_COPY.company}
					</h3>
					<p className="mt-1 text-sm">{currentCompany.name}</p>
					<OpenSourceRecordButton
						onOpen={onOpenCompany}
						recordId={currentCompany.id}
					/>
				</section>
			) : null}
			{profile.relatedFeedback.map((item) => (
				<RelatedSourceLink
					key={item.id}
					openSourceRecord={item.openSourceRecord}
					title={item.title.length > 0 ? item.title : item.id}
				/>
			))}
			{profile.relatedPersonaDocuments.map((item) => (
				<RelatedSourceLink
					key={item.id}
					openSourceRecord={item.openSourceRecord}
					title={item.title}
				/>
			))}
		</article>
	);
}

function OpenSourceRecordButton({
	onOpen,
	recordId,
}: {
	onOpen: (id: string) => void;
	recordId: string;
}) {
	const onClick = useCallback(() => {
		onOpen(recordId);
	}, [onOpen, recordId]);
	return (
		<Button onClick={onClick} type="button" variant="ghost">
			{CONTACT_AND_COMPANY_COPY.openSourceRecord}
		</Button>
	);
}

function RelatedSourceLink({
	openSourceRecord,
	title,
}: {
	openSourceRecord: string;
	title: string;
}) {
	return (
		<section>
			<p className="text-sm">{title}</p>
			<a className="text-sm underline-offset-4 hover:underline" href="/wiki">
				{openSourceRecord}
			</a>
		</section>
	);
}
