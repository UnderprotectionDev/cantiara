import { SOURCE_EXTERNAL_RECORD_TYPE, SOURCE_PROVIDER } from "./sources-model";

export interface SourceOriginFields {
	externalId: string | null;
	externalRecordType: string | null;
	provider: string | null;
}

const GITHUB_HOST = /^(www\.)?github\.com$/i;
const YOUTUBE_HOST = /^(www\.)?youtube\.com$/i;
const YOUTUBE_SHORT_HOST = /^youtu\.be$/i;
const LEADING_SLASH = /^\//;

export function resolveSourceOrigin(input: {
	externalId?: string;
	externalRecordType?: string;
	provider?: string;
	url: string;
}): SourceOriginFields {
	const fromUrl = originFromUrl(input.url);
	return {
		externalId: input.externalId ?? fromUrl.externalId,
		externalRecordType: input.externalRecordType ?? fromUrl.externalRecordType,
		provider: input.provider ?? fromUrl.provider,
	};
}

function originFromUrl(rawUrl: string): SourceOriginFields {
	const parsed = parseHttpUrl(rawUrl);
	if (!parsed) {
		return emptyOrigin();
	}
	const host = parsed.hostname;
	if (GITHUB_HOST.test(host)) {
		return githubOrigin(parsed.pathname);
	}
	if (YOUTUBE_HOST.test(host)) {
		return youtubeWatchOrigin(parsed);
	}
	if (YOUTUBE_SHORT_HOST.test(host)) {
		const [videoId] = parsed.pathname.replace(LEADING_SLASH, "").split("/");
		return youtubeVideo(videoId);
	}
	return emptyOrigin();
}

function githubOrigin(pathname: string): SourceOriginFields {
	const [owner, repo, kind, recordId] = pathname
		.replace(LEADING_SLASH, "")
		.split("/")
		.filter(Boolean);
	if (!(owner && repo)) {
		return emptyOrigin();
	}
	if (kind === "issues" && recordId) {
		return {
			externalId: `${owner}/${repo}#${recordId}`,
			externalRecordType: SOURCE_EXTERNAL_RECORD_TYPE.issue,
			provider: SOURCE_PROVIDER.github,
		};
	}
	if (kind === "pull" && recordId) {
		return {
			externalId: `${owner}/${repo}#${recordId}`,
			externalRecordType: SOURCE_EXTERNAL_RECORD_TYPE.pullRequest,
			provider: SOURCE_PROVIDER.github,
		};
	}
	return {
		externalId: `${owner}/${repo}`,
		externalRecordType: SOURCE_EXTERNAL_RECORD_TYPE.repository,
		provider: SOURCE_PROVIDER.github,
	};
}

function youtubeWatchOrigin(parsed: URL): SourceOriginFields {
	const fromQuery = parsed.searchParams.get("v");
	if (fromQuery) {
		return youtubeVideo(fromQuery);
	}
	if (parsed.pathname.startsWith("/shorts/")) {
		const [, , shortId] = parsed.pathname.split("/");
		return youtubeVideo(shortId);
	}
	return emptyOrigin();
}

function youtubeVideo(videoId: string | undefined): SourceOriginFields {
	if (!videoId) {
		return emptyOrigin();
	}
	return {
		externalId: videoId,
		externalRecordType: SOURCE_EXTERNAL_RECORD_TYPE.video,
		provider: SOURCE_PROVIDER.youtube,
	};
}

function parseHttpUrl(rawUrl: string): URL | null {
	try {
		const parsed = new URL(rawUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function emptyOrigin(): SourceOriginFields {
	return {
		externalId: null,
		externalRecordType: null,
		provider: null,
	};
}
