export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories_raw: {
        Row: {
          body: string | null
          created_at: string
          external_id: string
          id: string
          processed: boolean
          published_at: string | null
          source_name: string
          source_type: string
          title: string
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          external_id: string
          id?: string
          processed?: boolean
          published_at?: string | null
          source_name: string
          source_type: string
          title: string
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          external_id?: string
          id?: string
          processed?: boolean
          published_at?: string | null
          source_name?: string
          source_type?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      story_cards: {
        Row: {
          category: Database["public"]["Enums"]["story_category"]
          created_at: string
          credibility: Database["public"]["Enums"]["credibility_level"]
          id: string
          published_at: string | null
          raw_story_id: string | null
          source_link: string | null
          source_name: string
          summary_long: string | null
          summary_short: string
          title: string
          trend_score: Database["public"]["Enums"]["trend_score"]
          why_interesting: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["story_category"]
          created_at?: string
          credibility?: Database["public"]["Enums"]["credibility_level"]
          id?: string
          published_at?: string | null
          raw_story_id?: string | null
          source_link?: string | null
          source_name: string
          summary_long?: string | null
          summary_short: string
          title: string
          trend_score?: Database["public"]["Enums"]["trend_score"]
          why_interesting?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["story_category"]
          created_at?: string
          credibility?: Database["public"]["Enums"]["credibility_level"]
          id?: string
          published_at?: string | null
          raw_story_id?: string | null
          source_link?: string | null
          source_name?: string
          summary_long?: string | null
          summary_short?: string
          title?: string
          trend_score?: Database["public"]["Enums"]["trend_score"]
          why_interesting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_cards_raw_story_id_fkey"
            columns: ["raw_story_id"]
            isOneToOne: false
            referencedRelation: "stories_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      story_content_packs: {
        Row: {
          created_at: string
          hashtags: string | null
          hooks: string | null
          id: string
          shorts_script: string | null
          story_card_id: string
          thumbnail_texts: string | null
          user_id: string
          youtube_script: string | null
        }
        Insert: {
          created_at?: string
          hashtags?: string | null
          hooks?: string | null
          id?: string
          shorts_script?: string | null
          story_card_id: string
          thumbnail_texts?: string | null
          user_id: string
          youtube_script?: string | null
        }
        Update: {
          created_at?: string
          hashtags?: string | null
          hooks?: string | null
          id?: string
          shorts_script?: string | null
          story_card_id?: string
          thumbnail_texts?: string | null
          user_id?: string
          youtube_script?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_content_packs_story_card_id_fkey"
            columns: ["story_card_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin"
      credibility_level: "low" | "medium" | "high"
      story_category: "ufo" | "paranormal" | "unresolved" | "weird_news"
      subscription_plan: "free" | "basic" | "pro"
      subscription_status: "active" | "trialing" | "cancelled" | "past_due"
      trend_score: "hot" | "warm" | "cold"
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
    Enums: {
      app_role: ["user", "admin"],
      credibility_level: ["low", "medium", "high"],
      story_category: ["ufo", "paranormal", "unresolved", "weird_news"],
      subscription_plan: ["free", "basic", "pro"],
      subscription_status: ["active", "trialing", "cancelled", "past_due"],
      trend_score: ["hot", "warm", "cold"],
    },
  },
} as const
