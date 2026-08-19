#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const prdDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.dirname(prdDir);
const repositoryRoot = path.dirname(docsDir);
const expectedPrdFiles = [
	"01-product-vision-and-scope.md",
	"02-domain-model-and-lifecycle.md",
	"03-account-platform-operations.md",
	"04-workspace-and-projects.md",
	"05-capture-and-intake.md",
	"06-work-management-and-planning.md",
	"07-documents-and-knowledge.md",
	"08-search-relations-and-evidence.md",
	"09-discovery-decisions-and-design.md",
	"10-testing-and-validation.md",
	"11-technical-diagrams-and-schema-artifacts.md",
	"12-github-and-project-releases.md",
	"13-data-security-and-portability.md",
	"14-sharing-and-public-publishing.md",
	"15-product-quality.md",
	"16-product-acceptance.md",
	"17-commercial-expansion.md",
	"18-future-directions.md",
	"19-out-of-scope.md",
];
const acceptanceFile = "16-product-acceptance.md";
const requirementFiles = new Set(
	expectedPrdFiles.filter((file) => !file.startsWith("18-"))
);
const futureFile = "18-future-directions.md";
const expectedFutureCandidates = [
	"tek-seferlik-gerçeklik-devir-teslimi",
	"tek-sonuca-kilitlenen-çalışma-kipi",
	"kanıtlı-çapraz-proje-öğrenme-hafızası",
	"kayıt-değil-soru-odaklı-proje-işletimi",
	"proje-öncesi-fikir-inkübatörü",
	"doğrulanabilir-yapım-hikâyesi",
	"geri-döndürülebilirliğe-göre-karar-disiplini",
	"önceden-taahhüt-edilmiş-devam-bırakma-koşulları",
	"bilinçli-dış-sınır-sözleşmesi",
	"bir-kez-söyle-kontrollü-olarak-her-yere-işle",
	"sürüm-iletişim-iskeleti",
	"dış-ana-kaynak-işareti",
	"yüzey-metni-envanteri",
	"rakip-yırtma-defteri",
	"ilk-on-dakika-vaadi",
	"destek-oyun-kitabı",
	"kullanıcıya-veri-teslimi",
	"altyapı-maliyeti-notu",
	"dış-incelemeyi-geri-getiren-paylaşım",
	"ekip-kurmadan-sınırlı-insan-delegasyonu",
	"canlı-projenin-operasyonel-yükümlülükleri",
];
const futureContractIdPattern = /\|\s*`([^`]+)`\s*\|$/u;
const headingPattern = /^#{2,6}\s+/u;
const anyHeadingPattern = /^#{1,6}\s+(.+)$/u;
const numberedPrdFilePattern = /^\d{2}-.*\.md$/u;
const remoteArtifactPattern = /^(?:https|r2):\/\//u;
const fencePattern = /^```/;
const futureContractLabels = [
	"**Tetikleyici:**",
	"**İlk dilim:**",
	"**İlerleme ve bırakma ölçütü:**",
];
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	cwd: repositoryRoot,
	encoding: "utf8",
}).trim();
const sourceDirty =
	execFileSync("git", ["status", "--porcelain"], {
		cwd: repositoryRoot,
		encoding: "utf8",
	}).trim() !== "";

function slugify(value) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[’']/gu, "")
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/\s+/gu, "-")
		.replace(/-+/gu, "-");
}

function plain(value) {
	return value
		.replace(/<a\s+[^>]+><\/a>/gu, "")
		.replace(/!??\[([^\]]+)\]\([^)]+\)/gu, "$1")
		.replace(/[`*_]/gu, "")
		.trim();
}

function scopeFor(file, heading) {
	if (
		file.startsWith("17-") ||
		(file === acceptanceFile && heading === "Ticari genişleme kabulü")
	) {
		return "commercial-expansion";
	}
	return "first-product";
}

// 16-product-acceptance.md#kapsam-izlenebilirligi: sınıf kaynak belgesinden türer.
// Kabul yöntemi kanıtın tanımı olduğu için kendisi kanıt veya uygulama işi üretmez.
function classFor(file) {
	if (file === acceptanceFile) {
		return "kabul yöntemi";
	}
	if (file.startsWith("19-")) {
		return "negatif sınır";
	}
	return "davranış vaadi";
}

function requiresEvidence(requirement) {
	return requirement.class !== "kabul yöntemi";
}

const errors = [];
const warnings = [];
const requirements = [];
const files = fs
	.readdirSync(prdDir)
	.filter((file) => requirementFiles.has(file))
	.sort();

for (const file of files) {
	const lines = fs.readFileSync(path.join(prdDir, file), "utf8").split("\n");
	let inFence = false;
	let inNormativeBody = false;
	let heading = "";
	let anchor = "";
	let pendingAnchor = "";
	const labels = new Map();

	function add(label, lineNumber, kind) {
		const natural = plain(label);
		if (!natural) {
			errors.push(`${file}:${lineNumber}: boş doğal vaat adı`);
			return;
		}
		const key = `${heading}\u0000${natural.toLocaleLowerCase("tr-TR")}`;
		if (labels.has(key)) {
			errors.push(
				`${file}:${lineNumber}: aynı bölümde yinelenen doğal vaat adı "${natural}"; ilk kullanım ${labels.get(key)}`
			);
			return;
		}
		labels.set(key, lineNumber);
		const scope = scopeFor(file, heading);
		const source = `${file}#${anchor || slugify(heading)}`;
		requirements.push({
			class: classFor(file),
			kind,
			line: lineNumber,
			name: natural,
			ref: `${source} :: ${natural}`,
			scope,
			section: heading,
			source,
		});
	}

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const lineNumber = index + 1;
		if (/^```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}

		const withoutInlineCode = line.replace(/`[^`]*`/gu, "");
		if ((withoutInlineCode.match(/\*\*/gu) || []).length % 2 !== 0) {
			errors.push(`${file}:${lineNumber}: kapanmamış Markdown strong işareti`);
		}

		const explicitAnchor = line.match(/^<a\s+id="([^"]+)"/u);
		if (explicitAnchor) {
			const [, explicitAnchorId] = explicitAnchor;
			pendingAnchor = explicitAnchorId;
			continue;
		}

		const headingMatch = line.match(/^#{2,6}\s+(.+)$/u);
		if (headingMatch) {
			inNormativeBody = true;
			heading = plain(headingMatch[1]);
			anchor = pendingAnchor || slugify(heading);
			pendingAnchor = "";
			continue;
		}
		if (!inNormativeBody || line === "" || /^---$/.test(line)) {
			continue;
		}

		const labelled = line.match(/^(?:[-*]|\d+\.)\s+\*\*([^*]+)\*\*/u);
		if (labelled) {
			add(labelled[1], lineNumber, "markdown-item", line);
			continue;
		}

		if (/^\|/.test(line)) {
			const cells = line
				.slice(1, line.endsWith("|") ? -1 : undefined)
				.split("|")
				.map((cell) => cell.trim());
			if (cells.length > 0 && cells[0] && !/^[-: ]+$/u.test(cells[0])) {
				const next = lines[index + 1] || "";
				const isHeader = /^\|?\s*[-:]+/u.test(next);
				if (!isHeader) {
					add(cells[0], lineNumber, "table-row", line);
				}
			}
			continue;
		}

		if (!/^\s+/.test(line)) {
			const nextNonBlank =
				lines.slice(index + 1).find((candidate) => candidate.trim() !== "") ||
				"";
			if (/:$/u.test(line) && /^(?:[-*]|\d+\.|\|)\s*/u.test(nextNonBlank)) {
				continue;
			}
			errors.push(
				`${file}:${lineNumber}: doğal vaat maddesi olmayan normatif metin`
			);
		}
	}
}

const futureLines = fs
	.readFileSync(path.join(prdDir, futureFile), "utf8")
	.split("\n");
const validationLayersLine = futureLines.indexOf("### Doğrulama katmanları");
const firstFutureContractLine = futureLines.indexOf(
	`<a id="${expectedFutureCandidates[0]}"></a>`
);
if (
	validationLayersLine < 0 ||
	firstFutureContractLine < 0 ||
	validationLayersLine >= firstFutureContractLine
) {
	errors.push(
		`${futureFile}: Doğrulama katmanları tablosu veya kanonik gelecek adayı bloğu bulunamadı`
	);
}
const validationLayerLines = futureLines.slice(
	validationLayersLine,
	firstFutureContractLine
);
const futureBodies = new Map();
if (
	!(
		futureLines.some((line) =>
			line.includes("Bu belge iki açık sınıf taşır.")
		) && futureLines.some((line) => line.includes("Bağlayıcı olmayan yön notu"))
	)
) {
	errors.push(
		`${futureFile}: sözleşmeli aday ile bağlayıcı olmayan yön notu ayrımı açıkça tanımlanmıyor`
	);
}
const tableContractIds = validationLayerLines
	.map((line) => line.match(futureContractIdPattern)?.[1])
	.filter(Boolean);
for (const id of tableContractIds) {
	if (!expectedFutureCandidates.includes(id)) {
		errors.push(
			`${futureFile}: doğrulama tablosunda bilinmeyen sözleşmeli aday kimliği ${id}`
		);
	}
}
if (new Set(tableContractIds).size !== expectedFutureCandidates.length) {
	errors.push(
		`${futureFile}: doğrulama tablosu tam olarak ${expectedFutureCandidates.length} tekil sözleşmeli aday kimliği taşımalı`
	);
}

for (const candidate of expectedFutureCandidates) {
	const anchor = `<a id="${candidate}"></a>`;
	const anchorLines = futureLines
		.map((line, index) => (line === anchor ? index : -1))
		.filter((index) => index >= 0);
	const tableReferences = validationLayerLines.filter((line) =>
		line.includes(`](#${candidate})`)
	).length;
	const contractIdReferences = validationLayerLines.filter(
		(line) =>
			line.includes(`](#${candidate})`) && line.includes(`\`${candidate}\``)
	).length;
	if (tableReferences !== 1) {
		errors.push(
			`${futureFile}: Doğrulama katmanlarında ${candidate} için ${tableReferences} aday bağlantısı bulundu; tam olarak bir olmalı`
		);
	}
	if (contractIdReferences !== 1) {
		errors.push(
			`${futureFile}: Doğrulama katmanlarında ${candidate} için bağlantıyla aynı satırda tek sözleşme kimliği gerekli`
		);
	}
	if (anchorLines.length !== 1) {
		errors.push(
			`${futureFile}: ${candidate} için ${anchorLines.length} kanonik sözleşme anchor'ı bulundu; tam olarak bir olmalı`
		);
		continue;
	}
	const [anchorLine] = anchorLines;
	if (!/^###\s+/u.test(futureLines[anchorLine + 1] || "")) {
		errors.push(
			`${futureFile}:${anchorLine + 1}: ${candidate} anchor'ını doğrudan aday başlığı izlemiyor`
		);
	}
	let end = anchorLine + 2;
	while (end < futureLines.length && !/^<a\s+id=/u.test(futureLines[end])) {
		end += 1;
	}
	const body = futureLines
		.slice(anchorLine + 2, end)
		.filter((line) => line.trim() !== "" && !headingPattern.test(line));
	futureBodies.set(candidate, body.join("\n"));
	if (body.length !== futureContractLabels.length) {
		errors.push(
			`${futureFile}:${anchorLine + 1}: ${candidate} sözleşmesi ${body.length} parça taşıyor; tetikleyici, ilk dilim ve ilerleme/bırakma olmak üzere tam olarak üç parça gerekli`
		);
		continue;
	}
	for (let index = 0; index < futureContractLabels.length; index += 1) {
		const label = futureContractLabels[index];
		if (
			!body[index].startsWith(`${label} `) ||
			body[index].slice(label.length).trim() === ""
		) {
			errors.push(
				`${futureFile}:${anchorLine + index + 3}: ${candidate} sözleşmesinde dolu ${label} parçası gerekli`
			);
		}
	}
}

for (const line of validationLayerLines) {
	const dependent = line.match(
		/^\|\s*Bağımlı\s*\|\s*\[[^\]]+\]\(#([^)]+)\)\s*\|\s*`[^`]+`\s*\|$/u
	);
	if (!dependent) {
		continue;
	}
	const body = futureBodies.get(dependent[1]) || "";
	if (!(/doğrulanmadan/u.test(body) && /\]\(#[^)]+\)/u.test(body))) {
		errors.push(
			`${futureFile}: Bağımlı aday ${dependent[1]} adlandırılmış ve bağlantılı bir önkoşul tanımlamıyor`
		);
	}
}

const numberedPrdFiles = fs
	.readdirSync(prdDir)
	.filter((file) => numberedPrdFilePattern.test(file))
	.sort();
if (numberedPrdFiles.join(",") !== expectedPrdFiles.join(",")) {
	errors.push(
		`PRD rol–dosya sırası beklenen 01–19 yapısıyla eşleşmiyor: ${numberedPrdFiles.join(", ")}`
	);
}

for (const file of numberedPrdFiles) {
	const lines = fs.readFileSync(path.join(prdDir, file), "utf8").split("\n");
	if (
		!(
			lines[2] &&
			/(?:tek normatif sahibidir|tek sahibidir|ana kaynağıdır|ana sahibidir)/u.test(
				lines[2]
			)
		)
	) {
		errors.push(
			`${file}:3: dosyanın tekil amacı ve normatif sahipliği açıklanmıyor`
		);
	}
}

const normativeFingerprints = new Map();
for (const file of numberedPrdFiles) {
	const lines = fs.readFileSync(path.join(prdDir, file), "utf8").split("\n");
	let inFence = false;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (/^```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}
		const isNamedItem = /^(?:[-*]|\d+\.)\s+\*\*/u.test(line);
		const isTableRow =
			/^\|/u.test(line) && !/^\|?\s*[-:]+/u.test(lines[index + 1] || "");
		if (!(isNamedItem || isTableRow)) {
			continue;
		}
		const fingerprint = plain(line)
			.toLocaleLowerCase("tr-TR")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();
		if (fingerprint.split(/\s+/u).length < 12) {
			continue;
		}
		const previous = normativeFingerprints.get(fingerprint);
		if (previous && previous.file !== file) {
			errors.push(
				`${file}:${index + 1}: başka belgede aynen yinelenen normatif hüküm; ilk kullanım ${previous.file}:${previous.line}`
			);
		} else if (!previous) {
			normativeFingerprints.set(fingerprint, { file, line: index + 1 });
		}
	}
}

function markdownFiles(directory) {
	const found = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.name === ".git" || entry.name === ".context") {
			continue;
		}
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			found.push(...markdownFiles(absolute));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			found.push(absolute);
		}
	}
	return found;
}

const linkSources = [
	path.join(repositoryRoot, "CONTEXT.md"),
	path.join(docsDir, "product-prd.md"),
	path.join(docsDir, "tech-stack.md"),
	...markdownFiles(path.join(docsDir, "adr")),
	...markdownFiles(prdDir),
].filter((file) => path.basename(file) !== "product-prd-legacy.md");
const anchorCache = new Map();
const preferredAnchorCache = new Map();

function anchorsFor(file) {
	if (anchorCache.has(file)) {
		return anchorCache.get(file);
	}
	const anchors = new Set();
	const preferredAnchors = new Map();
	const slugCounts = new Map();
	const lines = fs.readFileSync(file, "utf8").split("\n");
	let inFence = false;
	let pendingExplicitAnchor = "";
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (fencePattern.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}
		for (const match of line.matchAll(/<a\s+id="([^"]+)"/gu)) {
			if (anchors.has(match[1])) {
				errors.push(
					`${path.relative(repositoryRoot, file)}:${index + 1}: yinelenen açık bölüm kimliği ${match[1]}`
				);
			}
			const [, anchorId] = match;
			anchors.add(anchorId);
			pendingExplicitAnchor = anchorId;
		}
		const heading = line.match(anyHeadingPattern);
		if (!heading) {
			continue;
		}
		const base = slugify(plain(heading[1]));
		const count = slugCounts.get(base) || 0;
		const generated = count === 0 ? base : `${base}-${count}`;
		anchors.add(generated);
		if (pendingExplicitAnchor && pendingExplicitAnchor !== generated) {
			preferredAnchors.set(generated, pendingExplicitAnchor);
		}
		pendingExplicitAnchor = "";
		slugCounts.set(base, count + 1);
	}
	anchorCache.set(file, anchors);
	preferredAnchorCache.set(file, preferredAnchors);
	return anchors;
}

for (const source of linkSources) {
	anchorsFor(source);
}

let localLinkCount = 0;
for (const source of linkSources) {
	const lines = fs.readFileSync(source, "utf8").split("\n");
	let inFence = false;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (/^```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}
		for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
			const raw = match[1].trim().replace(/^<|>$/gu, "");
			if (/^(?:https?:|mailto:)/u.test(raw)) {
				continue;
			}
			const hashIndex = raw.indexOf("#");
			const filePart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
			const fragment =
				hashIndex >= 0 ? decodeURIComponent(raw.slice(hashIndex + 1)) : "";
			const target = filePart
				? path.resolve(path.dirname(source), decodeURIComponent(filePart))
				: source;
			localLinkCount += 1;
			if (!(fs.existsSync(target) && fs.statSync(target).isFile())) {
				errors.push(
					`${path.relative(repositoryRoot, source)}:${index + 1}: bulunamayan bağlantı hedefi ${raw}`
				);
				continue;
			}
			if (
				fragment &&
				target.endsWith(".md") &&
				!anchorsFor(target).has(fragment)
			) {
				errors.push(
					`${path.relative(repositoryRoot, source)}:${index + 1}: bulunamayan bölüm hedefi ${raw}`
				);
			} else if (fragment && target.endsWith(".md")) {
				const preferred = preferredAnchorCache.get(target)?.get(fragment);
				if (preferred) {
					warnings.push(
						`${path.relative(repositoryRoot, source)}:${index + 1}: açık kararlı anchor varken otomatik başlık slug'ı kullanılıyor: ${fragment}; ${preferred} tercih edilmeli`
					);
				}
			}
		}
	}
}

const currentPrdText = [
	fs.readFileSync(path.join(docsDir, "product-prd.md"), "utf8"),
	...numberedPrdFiles.map((file) =>
		fs.readFileSync(path.join(prdDir, file), "utf8")
	),
].join("\n");
for (const pattern of [
	/\bFP-\d{2}-\d{4}\b/u,
	/\bCE-\d{2}-\d{4}\b/u,
	/\bREQ-[A-Z]/u,
	/\bCLM-/u,
	/\bAC-\d/u,
	/`R[0-3]`/u,
]) {
	if (pattern.test(currentPrdText)) {
		errors.push(
			`güncel PRD okuyucu yüzeyinde kaldırılmış takip kodu bulundu: ${pattern}`
		);
	}
}

requirements.sort(
	(a, b) => a.source.localeCompare(b.source, "tr") || a.line - b.line
);

const manifestFlag = process.argv.indexOf("--manifest");
const scopeFlag = process.argv.indexOf("--scope");
const selectedScope =
	scopeFlag >= 0 ? process.argv[scopeFlag + 1] : "first-product";
if (!["first-product", "commercial-expansion"].includes(selectedScope)) {
	errors.push(`bilinmeyen kabul kapsamı: ${selectedScope}`);
}

// ADR-0011: kabul geçmişinin sessizce kopmaması sentetik kimlikle değil,
// sürümlü referans envanteri ve fark denetimiyle korunur.
const refInventoryPath = path.join(prdDir, "requirement-refs.json");
const currentRefs = requirements.map((requirement) => requirement.ref);

if (process.argv.includes("--refs-write")) {
	fs.writeFileSync(
		refInventoryPath,
		`${JSON.stringify({ refs: currentRefs, version: 1 }, null, 2)}\n`
	);
} else if (fs.existsSync(refInventoryPath)) {
	try {
		const stored = JSON.parse(fs.readFileSync(refInventoryPath, "utf8"));
		const storedRefs = new Set(Array.isArray(stored.refs) ? stored.refs : []);
		const liveRefs = new Set(currentRefs);
		const added = currentRefs.filter((ref) => !storedRefs.has(ref));
		const removed = [...storedRefs].filter((ref) => !liveRefs.has(ref));
		for (const ref of removed) {
			errors.push(`referans envanterinden düşen gereksinim: ${ref}`);
		}
		for (const ref of added) {
			errors.push(`referans envanterinde bulunmayan yeni gereksinim: ${ref}`);
		}
		if (added.length > 0 || removed.length > 0) {
			errors.push(
				"referans envanteri güncel değil; değişiklik gözden geçirildikten sonra --refs-write ile yeniden üretilmeli"
			);
		}
	} catch (error) {
		errors.push(`referans envanteri okunamadı: ${error.message}`);
	}
} else {
	errors.push(
		`referans envanteri bulunamadı: ${path.relative(repositoryRoot, refInventoryPath)}; --refs-write ile üretilmeli`
	);
}

function nonEmptyString(value) {
	return typeof value === "string" && value.trim() !== "";
}

function validIsoDate(value) {
	return nonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function validArtifactAddress(value) {
	if (!nonEmptyString(value)) {
		return false;
	}
	if (remoteArtifactPattern.test(value)) {
		return true;
	}
	const absolute = path.resolve(repositoryRoot, value);
	return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
}

function localArtifactPath(value) {
	if (!nonEmptyString(value) || remoteArtifactPattern.test(value)) {
		return "";
	}
	return path.resolve(repositoryRoot, value);
}

if (manifestFlag >= 0) {
	const manifestPath = process.argv[manifestFlag + 1];
	if (manifestPath) {
		try {
			const manifest = JSON.parse(
				fs.readFileSync(path.resolve(repositoryRoot, manifestPath), "utf8")
			);
			if (manifest.version !== 3) {
				errors.push(
					`kabul manifesti version=3 olmalı; bulunan ${manifest.version || "eksik"}`
				);
			}
			if (manifest.scope !== selectedScope) {
				errors.push(
					`kabul manifesti kapsamı eşleşmiyor: ${manifest.scope || "eksik"} != ${selectedScope}`
				);
			}
			if (manifest.sourceCommit !== sourceCommit) {
				errors.push(
					`kabul manifesti kaynak commit'i eşleşmiyor: ${manifest.sourceCommit || "eksik"} != ${sourceCommit}`
				);
			}
			if (sourceDirty && !process.argv.includes("--allow-dirty")) {
				errors.push(
					"kesin kabul manifesti kirli çalışma ağacına karşı doğrulanamaz; önce kaynak commit oluşturulmalı"
				);
			}
			if (!validIsoDate(manifest.createdAt)) {
				errors.push("kabul manifestinde geçerli createdAt zamanı gerekli");
			}
			const { releaseCandidate } = manifest;
			if (!releaseCandidate || typeof releaseCandidate !== "object") {
				errors.push("kabul manifestinde releaseCandidate nesnesi gerekli");
			} else {
				for (const field of ["id", "build", "schemaVersion"]) {
					if (!nonEmptyString(releaseCandidate[field])) {
						errors.push(`kabul manifestinde releaseCandidate.${field} gerekli`);
					}
				}
			}

			const expected = requirements.filter(
				(requirement) =>
					requirement.scope === selectedScope && requiresEvidence(requirement)
			);
			const expectedByRef = new Map(
				expected.map((requirement) => [requirement.ref, requirement])
			);
			const coverage = new Map(
				expected.map((requirement) => [requirement.ref, []])
			);
			const evidenceRows = Array.isArray(manifest.evidence)
				? manifest.evidence
				: [];
			if (evidenceRows.length === 0) {
				errors.push("kabul manifestinde en az bir evidence kaydı gerekli");
			}
			const evidenceIds = new Set();

			for (const row of evidenceRows) {
				if (!nonEmptyString(row.id)) {
					errors.push("kabul manifestinde kimliksiz evidence kaydı");
				} else if (evidenceIds.has(row.id)) {
					errors.push(
						`kabul manifestinde yinelenen evidence kimliği: ${row.id}`
					);
				} else {
					evidenceIds.add(row.id);
				}

				if (
					!Array.isArray(row.requirementRefs) ||
					row.requirementRefs.length === 0
				) {
					errors.push(
						`evidence ${row.id || "kimliksiz"} en az bir requirementRefs girdisi taşımalı`
					);
				} else {
					const rowRequirementRefs = new Set();
					for (const ref of row.requirementRefs) {
						if (rowRequirementRefs.has(ref)) {
							errors.push(
								`evidence ${row.id || "kimliksiz"} aynı gereksinimi yineliyor: ${ref}`
							);
						}
						rowRequirementRefs.add(ref);
						const requirement = expectedByRef.get(ref);
						if (requirement) {
							coverage.get(ref).push(row.id || "kimliksiz");
						} else {
							errors.push(
								`evidence ${row.id || "kimliksiz"} kapsam dışında veya bilinmeyen gereksinim taşıyor: ${ref}`
							);
						}
					}
				}

				for (const field of ["testType", "fixture", "environment", "build"]) {
					if (!nonEmptyString(row[field])) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} için ${field} gerekli`
						);
					}
				}
				if (releaseCandidate && row.build !== releaseCandidate.build) {
					errors.push(
						`evidence ${row.id || "kimliksiz"} build'i release candidate ile eşleşmiyor: ${row.build || "eksik"} != ${releaseCandidate.build || "eksik"}`
					);
				}
				if (row.result !== "Geçti") {
					errors.push(`geçmeyen evidence: ${row.id || "kimliksiz"}`);
				}
				if (!["automated", "manual"].includes(row.execution)) {
					errors.push(
						`evidence ${row.id || "kimliksiz"} execution automated veya manual olmalı`
					);
				}

				const { artifact } = row;
				if (!artifact || typeof artifact !== "object") {
					errors.push(
						`evidence ${row.id || "kimliksiz"} için artifact nesnesi gerekli`
					);
				} else {
					if (!validArtifactAddress(artifact.address)) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} için çözümlenebilir https/r2 veya mevcut repo-relative artifact adresi gerekli`
						);
					}
					if (!/^[a-f0-9]{64}$/u.test(artifact.sha256 || "")) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} için 64 haneli sha256 gerekli`
						);
					}
					const localArtifact = localArtifactPath(artifact.address);
					if (
						localArtifact &&
						fs.existsSync(localArtifact) &&
						fs.statSync(localArtifact).isFile() &&
						/^[a-f0-9]{64}$/u.test(artifact.sha256 || "")
					) {
						const actualSha256 = createHash("sha256")
							.update(fs.readFileSync(localArtifact))
							.digest("hex");
						if (actualSha256 !== artifact.sha256) {
							errors.push(
								`evidence ${row.id || "kimliksiz"} artifact digest'i yerel dosyayla eşleşmiyor`
							);
						}
					}
					if (!validIsoDate(artifact.verifiedAt)) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} için geçerli artifact.verifiedAt gerekli`
						);
					}
					if (!validIsoDate(artifact.retainedUntil)) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} için geçerli artifact.retainedUntil gerekli`
						);
					}
					if (
						validIsoDate(artifact.retainedUntil) &&
						validIsoDate(manifest.createdAt) &&
						Date.parse(artifact.retainedUntil) <= Date.parse(manifest.createdAt)
					) {
						errors.push(
							`evidence ${row.id || "kimliksiz"} retention sonu manifest zamanından sonra olmalı`
						);
					}
				}

				if (row.execution === "automated") {
					for (const field of ["provider", "workflow", "runId"]) {
						if (!nonEmptyString(row.automation?.[field])) {
							errors.push(
								`otomatik evidence ${row.id || "kimliksiz"} için automation.${field} gerekli`
							);
						}
					}
				}
				if (row.execution === "manual") {
					if (!nonEmptyString(row.attestation?.performedBy)) {
						errors.push(
							`manuel evidence ${row.id || "kimliksiz"} için attestation.performedBy gerekli`
						);
					}
					if (!validIsoDate(row.attestation?.performedAt)) {
						errors.push(
							`manuel evidence ${row.id || "kimliksiz"} için geçerli attestation.performedAt gerekli`
						);
					}
				}
			}

			for (const requirement of expected) {
				if ((coverage.get(requirement.ref) || []).length === 0) {
					errors.push(
						`kabul manifestinde kanıtsız gereksinim: ${requirement.ref}`
					);
				}
			}
		} catch (error) {
			errors.push(`kabul manifesti okunamadı: ${error.message}`);
		}
	} else {
		errors.push("--manifest için dosya yolu gerekli");
	}
}

// Ticket sınırı denetimi: izlenebilirlik birimi bölüm kimliğidir. Bir ticket bir
// veya birkaç bölümü bütünüyle kapsar; bölümün yarısını alamaz ve aynı bölüm iki
// tickete bölünemez. Statü ticket sisteminde yaşar, bu araç yalnız sınırı denetler.
const coverageFlag = process.argv.indexOf("--coverage");
let coverageReport = null;
if (coverageFlag >= 0) {
	const coveragePath = process.argv[coverageFlag + 1];
	if (coveragePath) {
		try {
			const document = JSON.parse(
				fs.readFileSync(path.resolve(repositoryRoot, coveragePath), "utf8")
			);
			const tickets = Array.isArray(document.tickets) ? document.tickets : [];
			if (tickets.length === 0) {
				errors.push("kapsama dosyasında en az bir ticket gerekli");
			}

			const byRef = new Map(
				requirements.map((requirement) => [requirement.ref, requirement])
			);
			const sectionRefs = new Map();
			for (const requirement of requirements) {
				if (requirement.class !== "davranış vaadi") {
					continue;
				}
				if (!sectionRefs.has(requirement.source)) {
					sectionRefs.set(requirement.source, new Set());
				}
				sectionRefs.get(requirement.source).add(requirement.ref);
			}

			const sectionOwner = new Map();
			const ticketIds = new Set();
			for (const ticket of tickets) {
				const id = nonEmptyString(ticket.id) ? ticket.id : "";
				if (id) {
					if (ticketIds.has(id)) {
						errors.push(`kapsama dosyasında yinelenen ticket kimliği: ${id}`);
					}
					ticketIds.add(id);
				} else {
					errors.push("kapsama dosyasında kimliksiz ticket");
				}

				const refs = Array.isArray(ticket.requirementRefs)
					? ticket.requirementRefs
					: [];
				if (refs.length === 0) {
					errors.push(
						`ticket ${id || "kimliksiz"} en az bir requirementRefs girdisi taşımalı`
					);
				}
				const touchedSections = new Set();
				for (const ref of refs) {
					const requirement = byRef.get(ref);
					if (requirement) {
						if (requirement.class === "davranış vaadi") {
							touchedSections.add(requirement.source);
						} else {
							errors.push(
								`ticket ${id || "kimliksiz"} uygulama işi üretmeyen ${requirement.class} sınıfındaki gereksinimi taşıyor: ${ref}`
							);
						}
					} else {
						errors.push(
							`ticket ${id || "kimliksiz"} bilinmeyen gereksinim taşıyor: ${ref}`
						);
					}
				}
				for (const section of touchedSections) {
					const owner = sectionOwner.get(section);
					if (owner && owner !== id) {
						errors.push(
							`bölüm iki tickete bölünmüş: ${section}; ${owner} ve ${id || "kimliksiz"}`
						);
					} else {
						sectionOwner.set(section, id);
					}
					const missing = [...sectionRefs.get(section)].filter(
						(ref) => !refs.includes(ref)
					);
					for (const ref of missing) {
						errors.push(
							`ticket ${id || "kimliksiz"} bölümü bütün olarak kapsamıyor; eksik gereksinim: ${ref}`
						);
					}
				}
			}

			const allSections = [...sectionRefs.keys()].sort((a, b) =>
				a.localeCompare(b, "tr")
			);
			const uncovered = allSections.filter(
				(section) => !sectionOwner.has(section)
			);
			coverageReport = {
				coveredSections: allSections.length - uncovered.length,
				sections: allSections.length,
				tickets: tickets.length,
				uncoveredSections: uncovered,
			};
		} catch (error) {
			errors.push(`kapsama dosyası okunamadı: ${error.message}`);
		}
	} else {
		errors.push("--coverage için dosya yolu gerekli");
	}
}

if (process.argv.includes("--json")) {
	process.stdout.write(
		`${JSON.stringify({ coverage: coverageReport, requirements: requirements.filter((requirement) => requirement.scope === selectedScope), scope: selectedScope, sourceCommit, sourceDirty, version: 3, warnings }, null, 2)}\n`
	);
} else {
	const firstProduct = requirements.filter(
		(requirement) => requirement.scope === "first-product"
	).length;
	const commercial = requirements.filter(
		(requirement) => requirement.scope === "commercial-expansion"
	).length;
	const behaviour = requirements.filter(
		(requirement) => requirement.class === "davranış vaadi"
	).length;
	const negative = requirements.filter(
		(requirement) => requirement.class === "negatif sınır"
	).length;
	const method = requirements.filter(
		(requirement) => requirement.class === "kabul yöntemi"
	).length;
	console.log(
		`requirements=${requirements.length} first_product=${firstProduct} commercial_expansion=${commercial} behaviour=${behaviour} negative=${negative} method=${method} numbered_files=${numberedPrdFiles.length} local_links=${localLinkCount}`
	);
	if (coverageReport) {
		console.log(
			`coverage tickets=${coverageReport.tickets} sections=${coverageReport.coveredSections}/${coverageReport.sections} uncovered=${coverageReport.uncoveredSections.length}`
		);
	}
}

for (const warning of warnings) {
	console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
	for (const error of errors) {
		console.error(error);
	}
	process.exitCode = 1;
}
