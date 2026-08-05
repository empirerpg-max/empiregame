import { googleSheetsService } from "../services/googleSheetsService";
import { DRIVE_FOLDERS, uploadFileToDrive } from "../services/googleDriveService";

export interface CreateSongPayload {
  opcaoChart: string; // "a) Registrar essa música em chart" | "b) Substituir música no chart" | "c) Os comentários desse tópico devem valer para uma música já lançada"
  tituloMusica: string;
  nomeMusica: string;
  artistaPrincipal: string;
  participantes?: string[]; // Artistas 2 a 6
  tipoSingle: string;
  tipoMusica: string;
  capaUrl: string;
  mediaUrl?: string;
  nomeJogador: string;
  pendente?: string; // "Sim" | "Não"
}

export interface CreateVideoPayload {
  tituloVideo: string;
  artistaResponsavel: string;
  categoriaVideo?: string;
  participantes?: string[];
  capaUrl: string;
  mediaUrl?: string;
  nomeJogador: string;
}

export interface CreateMusicVideoPayload {
  tituloMusicVideo: string;
  artistaResponsavel: string;
  musicaVinculada?: string;
  participantes?: string[];
  capaUrl: string;
  mediaUrl?: string;
  nomeJogador: string;
}

export interface TrackItemPayload {
  num: number;
  titulo: string;
  inedita: boolean;
  tipoSingle?: string;
  tipoMusica?: string;
}

export interface CreateAlbumPayload {
  tituloAlbum: string;
  artistaAlbum: string;
  capaUrl: string;
  encartesUrls?: string[];
  nomeJogador: string;
  faixas: TrackItemPayload[];
}

export interface UploadPayload {
  fileName: string;
  mimeType: string;
  base64Data: string;
  folderType: "musica" | "album" | "video";
}

// Controller para Criar / Registrar Música
export async function createSongController(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateSongPayload;

    const {
      opcaoChart,
      tituloMusica,
      nomeMusica,
      artistaPrincipal,
      participantes = [],
      tipoSingle,
      tipoMusica,
      capaUrl,
      mediaUrl = "",
      nomeJogador,
      pendente = "Não",
    } = body;

    if (!tituloMusica || !artistaPrincipal || !nomeJogador) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campos obrigatórios ausentes: tituloMusica, artistaPrincipal, nomeJogador.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const featsStr = participantes.filter(Boolean).join(", ");
    const fullTitle = tituloMusica.includes(" - ")
      ? tituloMusica
      : `${artistaPrincipal} - ${nomeMusica || tituloMusica}`;

    // 1. Gravar em Musicas na planilha principal
    try {
      await googleSheetsService.principal.appendRow("Musicas", [
        nowStr,
        fullTitle,
        artistaPrincipal,
        featsStr,
        tipoSingle || "Single",
        tipoMusica || "Solo",
        opcaoChart || "a) Registrar essa música em chart",
        capaUrl || "",
        mediaUrl || "",
        pendente,
      ]);
    } catch (err) {
      console.warn("[createSongController] Erro ao gravar em Musicas (Principal):", err);
    }

    // 2. Gravar em REGISTRO DE MÚSICA na planilha de Registros
    try {
      await googleSheetsService.registrosCharts.appendRow("REGISTRO DE MÚSICA", [
        nowStr,
        nomeJogador,
        fullTitle,
        opcaoChart || "a) Registrar essa música em chart",
        capaUrl || "",
      ]);
    } catch (err) {
      console.warn("[createSongController] Erro ao gravar em REGISTRO DE MÚSICA:", err);
    }

    // 3. Gravar Audit Log na aba REGISTRO
    try {
      await googleSheetsService.registrosCharts.appendRow("REGISTRO", [
        nowStr,
        nomeJogador,
        fullTitle,
        "COMENTÁRIOS (SINGLES, VÍDEOS, MÚSICAS)",
      ]);
    } catch (err) {
      console.warn("[createSongController] Erro ao gravar no Audit Log REGISTRO:", err);
    }

    // 4. Gravar em Edição Charts
    try {
      await googleSheetsService.edicaoCharts.appendRow("Edição", [
        nowStr,
        fullTitle,
        artistaPrincipal,
        featsStr,
        opcaoChart || "a) Registrar essa música em chart",
        capaUrl || "",
        nomeJogador,
      ]);
    } catch (err) {
      console.warn("[createSongController] Erro ao gravar em Edição Charts:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: fullTitle,
          artistaPrincipal,
          nomeJogador,
          mensagem: "Música registrada com sucesso nos charts e banco de dados!",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[createSongController] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao processar lançamento de música.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Controller para Criar / Registrar Vídeo
export async function createVideoController(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateVideoPayload;
    const {
      tituloVideo,
      artistaResponsavel,
      categoriaVideo = "Vídeo Especial",
      participantes = [],
      capaUrl,
      mediaUrl = "",
      nomeJogador,
    } = body;

    if (!tituloVideo || !artistaResponsavel || !nomeJogador) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campos obrigatórios ausentes: tituloVideo, artistaResponsavel, nomeJogador.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const featsStr = participantes.filter(Boolean).join(", ");
    const fullTitle = tituloVideo.includes(" - ")
      ? tituloVideo
      : `${artistaResponsavel} - ${tituloVideo}`;

    // 1. Gravar na aba Videos da planilha principal
    try {
      await googleSheetsService.principal.appendRow("Videos", [
        nowStr,
        fullTitle,
        artistaResponsavel,
        featsStr,
        categoriaVideo,
        mediaUrl || "",
        capaUrl || "",
        "Não",
      ]);
    } catch (err) {
      console.warn("[createVideoController] Erro ao gravar em Videos:", err);
    }

    // 2. Audit Log em REGISTRO
    try {
      await googleSheetsService.registrosCharts.appendRow("REGISTRO", [
        nowStr,
        nomeJogador,
        fullTitle,
        "COMENTÁRIOS (SINGLES, VÍDEOS, MÚSICAS)",
      ]);
    } catch (err) {
      console.warn("[createVideoController] Erro no audit log:", err);
    }

    // 3. Gravar em Edição Charts
    try {
      await googleSheetsService.edicaoCharts.appendRow("Edição", [
        nowStr,
        fullTitle,
        artistaResponsavel,
        featsStr,
        `Lançamento de Vídeo (${categoriaVideo})`,
        capaUrl || "",
        nomeJogador,
      ]);
    } catch (err) {
      console.warn("[createVideoController] Erro em Edição Charts:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: fullTitle,
          artistaResponsavel,
          mensagem: "Vídeo cadastrado com sucesso!",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[createVideoController] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao registrar vídeo.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Controller para Criar / Registrar Music Video (MV)
export async function createMusicVideoController(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateMusicVideoPayload;
    const {
      tituloMusicVideo,
      artistaResponsavel,
      musicaVinculada = "",
      participantes = [],
      capaUrl,
      mediaUrl = "",
      nomeJogador,
    } = body;

    if (!tituloMusicVideo || !artistaResponsavel || !nomeJogador) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campos obrigatórios ausentes: tituloMusicVideo, artistaResponsavel, nomeJogador.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const featsStr = participantes.filter(Boolean).join(", ");
    const fullTitle = tituloMusicVideo.includes(" - ")
      ? tituloMusicVideo
      : `${artistaResponsavel} - ${tituloMusicVideo}`;

    // 1. Gravar em Music Videos na planilha principal
    try {
      await googleSheetsService.principal.appendRow("Music Videos", [
        nowStr,
        fullTitle,
        artistaResponsavel,
        featsStr,
        musicaVinculada || fullTitle,
        mediaUrl || "",
        capaUrl || "",
        "Não",
      ]);
    } catch (err) {
      console.warn("[createMusicVideoController] Erro em Music Videos:", err);
    }

    // 2. Audit Log em REGISTRO
    try {
      await googleSheetsService.registrosCharts.appendRow("REGISTRO", [
        nowStr,
        nomeJogador,
        fullTitle,
        "COMENTÁRIOS (SINGLES, VÍDEOS, MÚSICAS)",
      ]);
    } catch (err) {
      console.warn("[createMusicVideoController] Erro em audit log:", err);
    }

    // 3. Edição Charts
    try {
      await googleSheetsService.edicaoCharts.appendRow("Edição", [
        nowStr,
        fullTitle,
        artistaResponsavel,
        featsStr,
        "Lançamento de Music Video",
        capaUrl || "",
        nomeJogador,
      ]);
    } catch (err) {
      console.warn("[createMusicVideoController] Erro em Edição Charts:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: fullTitle,
          artistaResponsavel,
          mensagem: "Music Video cadastrado com sucesso!",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[createMusicVideoController] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao registrar Music Video.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Controller para Criar / Registrar Álbum
export async function createAlbumController(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateAlbumPayload;

    const {
      tituloAlbum,
      artistaAlbum,
      capaUrl,
      encartesUrls = [],
      nomeJogador,
      faixas = [],
    } = body;

    if (!tituloAlbum || !artistaAlbum || !nomeJogador) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campos obrigatórios ausentes: tituloAlbum, artistaAlbum, nomeJogador.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const nowStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const albumFullTitle = `${artistaAlbum} - ${tituloAlbum}`;
    const encartesStr = encartesUrls.join(", ");
    const tracklistStr = faixas.map((f, idx) => `${idx + 1}. ${f.titulo}`).join("\n");

    // 1. Processar faixas inéditas: registrar em 'Musicas' com Pendente? = "Sim"
    for (const faixa of faixas) {
      if (faixa.inedita) {
        const songTitle = faixa.titulo.includes(" - ")
          ? faixa.titulo
          : `${artistaAlbum} - ${faixa.titulo}`;

        try {
          await googleSheetsService.principal.appendRow("Musicas", [
            nowStr,
            songTitle,
            artistaAlbum,
            "",
            faixa.tipoSingle || "Faixa de Álbum",
            faixa.tipoMusica || "Solo",
            "a) Registrar essa música em chart",
            capaUrl || "",
            "",
            "Sim",
          ]);

          await googleSheetsService.registrosCharts.appendRow("REGISTRO DE MÚSICA", [
            nowStr,
            nomeJogador,
            songTitle,
            "Música Inédita do Álbum",
            capaUrl || "",
          ]);
        } catch (faixaErr) {
          console.warn("[createAlbumController] Erro ao registrar faixa inédita:", faixaErr);
        }
      }
    }

    // 2. Gravar Álbum na planilha principal
    try {
      await googleSheetsService.principal.appendRow("Albuns", [
        nowStr,
        albumFullTitle,
        artistaAlbum,
        capaUrl || "",
        encartesStr,
        tracklistStr,
        nomeJogador,
      ]);
    } catch (err) {
      console.warn("[createAlbumController] Erro ao gravar em Albuns (Principal):", err);
    }

    // 3. Gravar Audit Log na planilha de Registros
    try {
      await googleSheetsService.registrosCharts.appendRow("REGISTRO", [
        nowStr,
        nomeJogador,
        `(ALBUM) — ${albumFullTitle}`,
        "COMENTÁRIOS (TODOS OS TIPOS DE ÁLBUM)",
      ]);
    } catch (err) {
      console.warn("[createAlbumController] Erro ao gravar Audit Log de Álbum:", err);
    }

    // 4. Gravar em Edição Charts
    try {
      await googleSheetsService.edicaoCharts.appendRow("Edição", [
        nowStr,
        `(ALBUM) ${albumFullTitle}`,
        artistaAlbum,
        "",
        "Lançamento de Álbum",
        capaUrl || "",
        nomeJogador,
      ]);
    } catch (err) {
      console.warn("[createAlbumController] Erro ao gravar em Edição Charts:", err);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          titulo: albumFullTitle,
          artista: artistaAlbum,
          totalFaixas: faixas.length,
          mensagem: "Álbum e faixas registrados com sucesso!",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[createAlbumController] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro ao processar lançamento de álbum.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// Controller para Upload de Capa / Encartes no Google Drive
export async function uploadDriveController(request: Request): Promise<Response> {
  try {
    let fileName = "";
    let mimeType = "image/jpeg";
    let base64Data = "";
    let folderType: "musica" | "album" | "video" = "musica";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      fileName = String(formData.get("fileName") || file?.name || `file_${Date.now()}.jpg`);
      folderType = (formData.get("folderType") as any) || "musica";
      mimeType = file?.type || "image/jpeg";

      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        base64Data = Buffer.from(arrayBuffer).toString("base64");
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as UploadPayload;
      fileName = body.fileName || "";
      mimeType = body.mimeType || "image/jpeg";
      base64Data = body.base64Data || "";
      folderType = body.folderType || "musica";
    }

    if (!fileName && !base64Data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Arquivo ou dados do upload são obrigatórios.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const folderId = folderType === "album" ? DRIVE_FOLDERS.albuns : DRIVE_FOLDERS.musicas;

    const fileUrl = base64Data
      ? await uploadFileToDrive(fileName, folderId, mimeType, base64Data)
      : `https://drive.google.com/drive/folders/${folderId}`;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          fileName,
          fileUrl,
          folderType,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[uploadDriveController] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Falha ao enviar o arquivo para o Google Drive.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
