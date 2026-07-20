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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          category: string
          created_at: string
          id: number
          level: string
          message: string
          meta: Json | null
          ts_ms: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: number
          level: string
          message: string
          meta?: Json | null
          ts_ms: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: number
          level?: string
          message?: string
          meta?: Json | null
          ts_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      engine_heartbeats: {
        Row: {
          last_seen_at: string
          meta: Json | null
          mode: Database["public"]["Enums"]["pipeline_mode"] | null
          status: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          last_seen_at?: string
          meta?: Json | null
          mode?: Database["public"]["Enums"]["pipeline_mode"] | null
          status?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          last_seen_at?: string
          meta?: Json | null
          mode?: Database["public"]["Enums"]["pipeline_mode"] | null
          status?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      engine_kv: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      latency_samples: {
        Row: {
          created_at: string
          decision_ms: number
          exchange_order_id: string | null
          fill_check_ms: number
          fill_observed_ms: number | null
          filled_price: number | null
          id: number
          limit_price: number | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          pre_submit_ms: number
          quote_age_ms: number
          shares: number | null
          side: Database["public"]["Enums"]["trade_side"] | null
          submit_at_ms: number
          submit_ms: number
          total_ms: number
          ts_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_ms: number
          exchange_order_id?: string | null
          fill_check_ms: number
          fill_observed_ms?: number | null
          filled_price?: number | null
          id?: number
          limit_price?: number | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          pre_submit_ms: number
          quote_age_ms: number
          shares?: number | null
          side?: Database["public"]["Enums"]["trade_side"] | null
          submit_at_ms: number
          submit_ms: number
          total_ms: number
          ts_ms: number
          user_id: string
        }
        Update: {
          created_at?: string
          decision_ms?: number
          exchange_order_id?: string | null
          fill_check_ms?: number
          fill_observed_ms?: number | null
          filled_price?: number | null
          id?: number
          limit_price?: number | null
          market_id?: string
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          pre_submit_ms?: number
          quote_age_ms?: number
          shares?: number | null
          side?: Database["public"]["Enums"]["trade_side"] | null
          submit_at_ms?: number
          submit_ms?: number
          total_ms?: number
          ts_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      order_intents: {
        Row: {
          ambiguous_at_ms: number | null
          attempts: number
          client_order_id: string
          created_at_ms: number
          exchange_order_id: string | null
          failed_at_ms: number | null
          id: number
          last_error: string | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          price: number
          resting_at_ms: number | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          status: string
          submitted_at_ms: number | null
          token_id: string | null
          updated_at_ms: number
          user_id: string
        }
        Insert: {
          ambiguous_at_ms?: number | null
          attempts?: number
          client_order_id: string
          created_at_ms: number
          exchange_order_id?: string | null
          failed_at_ms?: number | null
          id?: number
          last_error?: string | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          price: number
          resting_at_ms?: number | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          status: string
          submitted_at_ms?: number | null
          token_id?: string | null
          updated_at_ms: number
          user_id: string
        }
        Update: {
          ambiguous_at_ms?: number | null
          attempts?: number
          client_order_id?: string
          created_at_ms?: number
          exchange_order_id?: string | null
          failed_at_ms?: number | null
          id?: number
          last_error?: string | null
          market_id?: string
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          price?: number
          resting_at_ms?: number | null
          shares?: number
          side?: Database["public"]["Enums"]["trade_side"]
          status?: string
          submitted_at_ms?: number | null
          token_id?: string | null
          updated_at_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      order_log: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          exchange_order_id: string | null
          id: number
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          phase: string | null
          price: number | null
          shares: number | null
          side: Database["public"]["Enums"]["trade_side"] | null
          token_id: string | null
          ts_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          exchange_order_id?: string | null
          id?: number
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          phase?: string | null
          price?: number | null
          shares?: number | null
          side?: Database["public"]["Enums"]["trade_side"] | null
          token_id?: string | null
          ts_ms: number
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          exchange_order_id?: string | null
          id?: number
          market_id?: string
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          phase?: string | null
          price?: number | null
          shares?: number | null
          side?: Database["public"]["Enums"]["trade_side"] | null
          token_id?: string | null
          ts_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      profile_sessions: {
        Row: {
          created_at: string
          ended_at_ms: number | null
          id: number
          profile_name: string
          started_at_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at_ms?: number | null
          id?: number
          profile_name: string
          started_at_ms: number
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at_ms?: number | null
          id?: number
          profile_name?: string
          started_at_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quarantined_exchange_orders: {
        Row: {
          client_order_id: string | null
          exchange_order_id: string
          id: number
          intent_id: number | null
          payload: Json | null
          quarantined_at_ms: number
          reason: string
          user_id: string
        }
        Insert: {
          client_order_id?: string | null
          exchange_order_id: string
          id?: number
          intent_id?: number | null
          payload?: Json | null
          quarantined_at_ms: number
          reason: string
          user_id: string
        }
        Update: {
          client_order_id?: string | null
          exchange_order_id?: string
          id?: number
          intent_id?: number | null
          payload?: Json | null
          quarantined_at_ms?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      strategy_profiles: {
        Row: {
          config: Json
          created_at: string
          created_at_ms: number
          id: number
          last_used_at_ms: number | null
          name: string
          notes: string
          updated_at: string
          updated_at_ms: number
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_at_ms: number
          id?: number
          last_used_at_ms?: number | null
          name: string
          notes?: string
          updated_at?: string
          updated_at_ms: number
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_at_ms?: number
          id?: number
          last_used_at_ms?: number | null
          name?: string
          notes?: string
          updated_at?: string
          updated_at_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          balance_after: number
          cost: number
          created_at: string
          dust_saved: number
          entry_at_ms: number | null
          explanation: Json | null
          id: number
          mark_price: number | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          order_id: string | null
          pnl: number
          price: number
          result: Database["public"]["Enums"]["trade_result"]
          settled_at: string | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          slot_end_ms: number
          status: Database["public"]["Enums"]["trade_status"]
          trade_uid: string | null
          unrealized_pnl: number | null
          user_id: string
        }
        Insert: {
          balance_after?: number
          cost: number
          created_at?: string
          dust_saved?: number
          entry_at_ms?: number | null
          explanation?: Json | null
          id?: number
          mark_price?: number | null
          market_id: string
          mode: Database["public"]["Enums"]["pipeline_mode"]
          order_id?: string | null
          pnl?: number
          price: number
          result?: Database["public"]["Enums"]["trade_result"]
          settled_at?: string | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          slot_end_ms: number
          status?: Database["public"]["Enums"]["trade_status"]
          trade_uid?: string | null
          unrealized_pnl?: number | null
          user_id: string
        }
        Update: {
          balance_after?: number
          cost?: number
          created_at?: string
          dust_saved?: number
          entry_at_ms?: number | null
          explanation?: Json | null
          id?: number
          mark_price?: number | null
          market_id?: string
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          order_id?: string | null
          pnl?: number
          price?: number
          result?: Database["public"]["Enums"]["trade_result"]
          settled_at?: string | null
          shares?: number
          side?: Database["public"]["Enums"]["trade_side"]
          slot_end_ms?: number
          status?: Database["public"]["Enums"]["trade_status"]
          trade_uid?: string | null
          unrealized_pnl?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      app_role: "admin" | "operator" | "viewer"
      pipeline_mode: "PAPER_V1" | "PAPER_V2" | "LIVE_V2"
      trade_result: "WIN" | "LOSS" | "SCRATCH" | "PENDING"
      trade_side: "YES" | "NO"
      trade_status: "OPEN" | "SETTLED"
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
      app_role: ["admin", "operator", "viewer"],
      pipeline_mode: ["PAPER_V1", "PAPER_V2", "LIVE_V2"],
      trade_result: ["WIN", "LOSS", "SCRATCH", "PENDING"],
      trade_side: ["YES", "NO"],
      trade_status: ["OPEN", "SETTLED"],
    },
  },
} as const
