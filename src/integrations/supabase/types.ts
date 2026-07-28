export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      tv_chat_messages: {
        Row: {
          created_at: string
          id: string
          programa_id: string
          reply_to: Json | null
          text: string
          user_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          programa_id: string
          reply_to?: Json | null
          text: string
          user_name: string
        }
        Update: {
          created_at?: string
          id?: string
          programa_id?: string
          reply_to?: Json | null
          text?: string
          user_name?: string
        }
        Relationships: []
      }
      Musicas: {
        Row: {
          id: number
          created_at: string
          Nome: string | null
          Artista: string | null
          Album: string | null
          "Capa da Musica": string | null
          "Link do audio": string | null
          telegram_file_id: string | null
          telegram_topic_id: number | null
          data_lancamento: string | null
          genero: string | null
          tipo_single: string | null
          tipo_musica: string | null
          ordem: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          Nome?: string | null
          Artista?: string | null
          Album?: string | null
          "Capa da Musica"?: string | null
          "Link do audio"?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
          data_lancamento?: string | null
          genero?: string | null
          tipo_single?: string | null
          tipo_musica?: string | null
          ordem?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          Nome?: string | null
          Artista?: string | null
          Album?: string | null
          "Capa da Musica"?: string | null
          "Link do audio"?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
          data_lancamento?: string | null
          genero?: string | null
          tipo_single?: string | null
          tipo_musica?: string | null
          ordem?: number | null
        }
        Relationships: []
      }
      Albuns: {
        Row: {
          id: number
          created_at: string
          "Nome do Album": string | null
          "Nome do Artista": string | null
          "Capa do Album": string | null
          "Link do audio": string | null
          telegram_topic_id: number | null
          data_lancamento: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          "Nome do Album"?: string | null
          "Nome do Artista"?: string | null
          "Capa do Album"?: string | null
          "Link do audio"?: string | null
          telegram_topic_id?: number | null
          data_lancamento?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          "Nome do Album"?: string | null
          "Nome do Artista"?: string | null
          "Capa do Album"?: string | null
          "Link do audio"?: string | null
          telegram_topic_id?: number | null
          data_lancamento?: string | null
        }
        Relationships: []
      }
      Videos: {
        Row: {
          id: number
          created_at: string
          Titulo: string | null
          Artista: string | null
          Capa: string | null
          telegram_file_id: string | null
          telegram_topic_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          Titulo?: string | null
          Artista?: string | null
          Capa?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          Titulo?: string | null
          Artista?: string | null
          Capa?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
        }
        Relationships: []
      }
      "Music Videos": {
        Row: {
          id: number
          created_at: string
          Titulo: string | null
          Artista: string | null
          Capa: string | null
          telegram_file_id: string | null
          telegram_topic_id: number | null
          tipo: string | null
          data_lancamento: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          Titulo?: string | null
          Artista?: string | null
          Capa?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
          tipo?: string | null
          data_lancamento?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          Titulo?: string | null
          Artista?: string | null
          Capa?: string | null
          telegram_file_id?: string | null
          telegram_topic_id?: number | null
          tipo?: string | null
          data_lancamento?: string | null
        }
        Relationships: []
      }
      Top_50_Spotify: {
        Row: {
          id: number
          created_at: string
          posicao: number | null
          nome_musica: string | null
          capa_musica: string | null
          link_audio: string | null
          telegram_topic_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_musica?: string | null
          capa_musica?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_musica?: string | null
          capa_musica?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Relationships: []
      }
      Top_Songs_Apple_Music: {
        Row: {
          id: number
          created_at: string
          posicao: number | null
          nome_musica: string | null
          capa_musica: string | null
          link_audio: string | null
          telegram_topic_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_musica?: string | null
          capa_musica?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_musica?: string | null
          capa_musica?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Relationships: []
      }
      Top_Videos_YT: {
        Row: {
          id: number
          created_at: string
          posicao: number | null
          nome_video: string | null
          thumb: string | null
          link_audio: string | null
          telegram_topic_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_video?: string | null
          thumb?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          posicao?: number | null
          nome_video?: string | null
          thumb?: string | null
          link_audio?: string | null
          telegram_topic_id?: number | null
        }
        Relationships: []
      }
      Comentarios_Musicas: {
        Row: {
          id: number
          created_at: string
          telegram_topic_id: number | null
          id_jogador: string | null
          nome_jogador: string | null
          comentario: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
        }
        Relationships: []
      }
      Comentarios_MV: {
        Row: {
          id: number
          created_at: string
          telegram_topic_id: number | null
          id_jogador: string | null
          nome_jogador: string | null
          comentario: string | null
          data: string | null
          telegram_message_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
          data?: string | null
          telegram_message_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
          data?: string | null
          telegram_message_id?: number | null
        }
        Relationships: []
      }
      Comentarios_Videos: {
        Row: {
          id: number
          created_at: string
          telegram_topic_id: number | null
          texto: string | null
          autor: string | null
          id_usuario: string | null
          data: string | null
          reacoes: string | null
          telegram_message_id: number | null
        }
        Insert: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          texto?: string | null
          autor?: string | null
          id_usuario?: string | null
          data?: string | null
          reacoes?: string | null
          telegram_message_id?: number | null
        }
        Update: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          texto?: string | null
          autor?: string | null
          id_usuario?: string | null
          data?: string | null
          reacoes?: string | null
          telegram_message_id?: number | null
        }
        Relationships: []
      }
      Comentarios_Albuns: {
        Row: {
          id: number
          created_at: string
          telegram_topic_id: number | null
          id_jogador: string | null
          nome_jogador: string | null
          comentario: string | null
          data: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
          data?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          telegram_topic_id?: number | null
          id_jogador?: string | null
          nome_jogador?: string | null
          comentario?: string | null
          data?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
