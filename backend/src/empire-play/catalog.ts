import { empireSheets } from "../google/sheets";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type CatalogKind = "musicas" | "music-videos" | "videos" | "albuns";

type CatalogFilters = {
  artist?: string;
  month?: string;
  search?: string;
};

type NormalizedSheetRecord = Record<string, string>;

export interface UserProfileResponse {
  artistName: string;
  telegramId: string;
  playerName: string;
  associatedArtists: string[];
  sourceSheet: string;
  rowNumber: number;
}

export interface CatalogItem {
  id: string;
  type: CatalogKind | "top-playlist";
  sheetName: string;
  title: string;
  artist: string;
  album: string | null;
  cover: string | null;
  link: string | null;
  releaseDate: string | null;
  releaseDateIso: string | null;
  releaseMonth: string | null;
  position: number | null;
  telegramTopicId: string | null;
  fields: NormalizedSheetRecord;
}

export interface TopPlaylistsResponse {
  spotify: CatalogItem[];
  appleMusic: CatalogItem[];
  youtube: CatalogItem[];
}

const CATALOG_SHEETS: Record<CatalogKind, string> = {
  musicas: "Musicas",
  "music-videos": "Music Videos",
  videos: "Videos",
  albuns: "Albuns",
};

const TOP_PLAYLIST_SHEETS = {
  spotify: "Top_50_Spotify",
  appleMusic: "Top_Songs_Apple_Music",
  youtube: "Top_Videos_YT",
} as const;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeComparison(value: unknown): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeHeader(value: unknown): string {
  return normalizeComparison(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => !normalizeText(cell));
}

function sheetRowsToObjects(rows: string[][]): NormalizedSheetRecord[] {
  if (rows.length < 2) return [];

  const headers = rows[0].map((header, index) => {
    const normalized = normalizeHeader(header);
    return normalized || `coluna_${index + 1}`;
  });

  return rows.slice(1).filter((row) => !isBlankRow(row)).map((row) => {
    const record: NormalizedSheetRecord = {};

    headers.forEach((header, index) => {
      record[header] = normalizeText(row[index]);
    });

    return record;
  });
}

function getValue(
  record: NormalizedSheetRecord,
  aliases: string[],
): string | null {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const value = record[normalizedAlias];
    if (normalizeText(value)) {
      return normalizeText(value);
    }
  }

  return null;
}

function parseArtistList(value: string | null): string[] {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/\r?\n|,|;|\|/g)
        .map((item) => item.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean),
    ),
  );
}

function parseDateToIso(value: string | null): string | null {
  if (!value) return null;

  const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const yyyymmdd = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function extractReleaseMonth(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const [year, month] = isoDate.split("-");
  return `${month}/${year}`;
}

function matchesMonth(isoDate: string | null, requestedMonth?: string): boolean {
  if (!requestedMonth) return true;
  if (!isoDate) return false;

  const normalizedFilter = requestedMonth.trim();
  const [year, month] = isoDate.split("-");
  const mmYyyy = `${month}/${year}`;
  const yyyyMm = `${year}-${month}`;

  return (
    normalizedFilter === mmYyyy ||
    normalizedFilter === yyyyMm ||
    normalizedFilter === `${month}-${year}` ||
    normalizedFilter === month
  );
}

function buildCatalogItem(
  kind: CatalogKind | "top-playlist",
  sheetName: string,
  record: NormalizedSheetRecord,
  index: number,
): CatalogItem {
  const title =
    getValue(record, [
      "nome_da_musica",
      "nome_do_video",
      "nome_do_album",
      "nome",
      "titulo",
      "titulo_do_video",
      "titulo_do_album",
    ]) || "";

  const artist = getValue(record, [
    "act_principal",
    "artista",
    "nome_do_criador",
    "nome_do_artista",
  ]) || "";

  const album = getValue(record, ["album", "nome_do_album", "album_nome"]);
  const cover = getValue(record, [
    "capa_da_musica",
    "capa_do_album",
    "thumb",
    "capa",
    "thumbnail_url",
  ]);
  const link = getValue(record, [
    "link_do_audio",
    "link_audio",
    "link",
    "telegram_file_url",
  ]);
  const releaseDate = getValue(record, [
    "data_de_lancamento",
    "data_lancamento",
    "data",
  ]);
  const releaseDateIso = parseDateToIso(releaseDate);
  const positionValue = getValue(record, ["posicao", "posição"]);
  const parsedPosition =
    positionValue && !Number.isNaN(Number(positionValue))
      ? Number(positionValue)
      : null;
  const telegramTopicId = getValue(record, [
    "id_do_topico",
    "telegram_topic_id",
  ]);

  return {
    id: `${sheetName}:${telegramTopicId || title || index + 1}`,
    type: kind,
    sheetName,
    title,
    artist,
    album,
    cover,
    link,
    releaseDate,
    releaseDateIso,
    releaseMonth: extractReleaseMonth(releaseDateIso),
    position: parsedPosition,
    telegramTopicId,
    fields: record,
  };
}

function compareCatalogItems(a: CatalogItem, b: CatalogItem): number {
  if (a.releaseDateIso && b.releaseDateIso) {
    return b.releaseDateIso.localeCompare(a.releaseDateIso);
  }

  if (a.position !== null && b.position !== null) {
    return a.position - b.position;
  }

  return a.title.localeCompare(b.title, "pt-BR");
}

function matchesFilters(item: CatalogItem, filters: CatalogFilters): boolean {
  const normalizedArtist = normalizeComparison(filters.artist);
  const normalizedSearch = normalizeComparison(filters.search);
  const haystack = normalizeComparison(
    [item.title, item.artist, item.album, Object.values(item.fields).join(" ")]
      .filter(Boolean)
      .join(" "),
  );

  if (normalizedArtist) {
    const artistField = normalizeComparison(item.artist);
    if (!artistField.includes(normalizedArtist)) {
      return false;
    }
  }

  if (!matchesMonth(item.releaseDateIso, filters.month)) {
    return false;
  }

  if (normalizedSearch && !haystack.includes(normalizedSearch)) {
    return false;
  }

  return true;
}

async function readPrincipalSheetObjects(sheetName: string): Promise<NormalizedSheetRecord[]> {
  const rows = await empireSheets.principal.readValues(sheetName);
  return sheetRowsToObjects(rows);
}

export async function getUserProfile(telegramId: string): Promise<UserProfileResponse> {
  const rows = await empireSheets.principal.readValues("Jogadores", "A:M");

  if (rows.length === 0) {
    throw new ApiError(404, "A aba Jogadores está vazia ou indisponível.");
  }

  const normalizedTelegramId = normalizeText(telegramId);

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const artistName = normalizeText(row[0]);
    const rowTelegramId = normalizeText(row[1]);
    const playerName = normalizeText(row[2]);
    const associatedArtistsCell = normalizeText(row[12]);

    if (!rowTelegramId || rowTelegramId !== normalizedTelegramId) {
      continue;
    }

    const associatedArtists = Array.from(
      new Set([artistName, ...parseArtistList(associatedArtistsCell)].filter(Boolean)),
    );

    return {
      artistName,
      telegramId: rowTelegramId,
      playerName,
      associatedArtists,
      sourceSheet: "Jogadores",
      rowNumber: index + 1,
    };
  }

  throw new ApiError(
    404,
    "Telegram ID não encontrado na aba Jogadores da planilha principal.",
  );
}

export async function getTopPlaylists(): Promise<TopPlaylistsResponse> {
  const [spotifyRows, appleMusicRows, youtubeRows] = await Promise.all([
    readPrincipalSheetObjects(TOP_PLAYLIST_SHEETS.spotify),
    readPrincipalSheetObjects(TOP_PLAYLIST_SHEETS.appleMusic),
    readPrincipalSheetObjects(TOP_PLAYLIST_SHEETS.youtube),
  ]);

  return {
    spotify: spotifyRows
      .map((record, index) =>
        buildCatalogItem("top-playlist", TOP_PLAYLIST_SHEETS.spotify, record, index),
      )
      .sort(compareCatalogItems),
    appleMusic: appleMusicRows
      .map((record, index) =>
        buildCatalogItem("top-playlist", TOP_PLAYLIST_SHEETS.appleMusic, record, index),
      )
      .sort(compareCatalogItems),
    youtube: youtubeRows
      .map((record, index) =>
        buildCatalogItem("top-playlist", TOP_PLAYLIST_SHEETS.youtube, record, index),
      )
      .sort(compareCatalogItems),
  };
}

export async function getRecentReleases(limit = 30): Promise<CatalogItem[]> {
  const records = await readPrincipalSheetObjects(CATALOG_SHEETS.musicas);

  return records
    .map((record, index) =>
      buildCatalogItem("musicas", CATALOG_SHEETS.musicas, record, index),
    )
    .filter((item) => item.releaseDateIso)
    .sort(compareCatalogItems)
    .slice(0, limit);
}

export async function getCatalog(
  kind: CatalogKind,
  filters: CatalogFilters,
): Promise<CatalogItem[]> {
  const sheetName = CATALOG_SHEETS[kind];
  const records = await readPrincipalSheetObjects(sheetName);

  return records
    .map((record, index) => buildCatalogItem(kind, sheetName, record, index))
    .filter((item) => matchesFilters(item, filters))
    .sort(compareCatalogItems);
}
