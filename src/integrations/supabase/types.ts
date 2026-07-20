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
          execution_id: string | null
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
          execution_id?: string | null
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
          execution_id?: string | null
          id?: number
          level?: string
          message?: string
          meta?: Json | null
          ts_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      btc5m_contract_history: {
        Row: {
          archived_at: string
          engine_instance_id: string | null
          event_id: string | null
          final_no_price: number | null
          final_outcome: string | null
          final_yes_price: number | null
          id: number
          liquidity: number | null
          market_id: string
          meta: Json | null
          no_token_id: string | null
          question: string | null
          resolution_at: string | null
          slot_end_ms: number
          slot_start_ms: number
          slug: string | null
          total_standing_orders: number
          total_trades: number
          user_id: string
          volume: number | null
          winning_side: string | null
          yes_token_id: string | null
        }
        Insert: {
          archived_at?: string
          engine_instance_id?: string | null
          event_id?: string | null
          final_no_price?: number | null
          final_outcome?: string | null
          final_yes_price?: number | null
          id?: number
          liquidity?: number | null
          market_id: string
          meta?: Json | null
          no_token_id?: string | null
          question?: string | null
          resolution_at?: string | null
          slot_end_ms: number
          slot_start_ms: number
          slug?: string | null
          total_standing_orders?: number
          total_trades?: number
          user_id: string
          volume?: number | null
          winning_side?: string | null
          yes_token_id?: string | null
        }
        Update: {
          archived_at?: string
          engine_instance_id?: string | null
          event_id?: string | null
          final_no_price?: number | null
          final_outcome?: string | null
          final_yes_price?: number | null
          id?: number
          liquidity?: number | null
          market_id?: string
          meta?: Json | null
          no_token_id?: string | null
          question?: string | null
          resolution_at?: string | null
          slot_end_ms?: number
          slot_start_ms?: number
          slug?: string | null
          total_standing_orders?: number
          total_trades?: number
          user_id?: string
          volume?: number | null
          winning_side?: string | null
          yes_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "btc5m_contract_history_engine_instance_id_fkey"
            columns: ["engine_instance_id"]
            isOneToOne: false
            referencedRelation: "engine_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      btc5m_markets: {
        Row: {
          best_ask_yes: number | null
          best_bid_yes: number | null
          created_at: string
          eligible: boolean
          id: number
          ineligible_reason: string | null
          last_price_yes: number | null
          last_tick_at: string | null
          market_id: string
          meta: Json | null
          no_token_id: string | null
          question: string | null
          slot_end_ms: number
          slot_start_ms: number
          slug: string | null
          status: string
          updated_at: string
          user_id: string
          yes_token_id: string | null
        }
        Insert: {
          best_ask_yes?: number | null
          best_bid_yes?: number | null
          created_at?: string
          eligible?: boolean
          id?: number
          ineligible_reason?: string | null
          last_price_yes?: number | null
          last_tick_at?: string | null
          market_id: string
          meta?: Json | null
          no_token_id?: string | null
          question?: string | null
          slot_end_ms: number
          slot_start_ms: number
          slug?: string | null
          status?: string
          updated_at?: string
          user_id: string
          yes_token_id?: string | null
        }
        Update: {
          best_ask_yes?: number | null
          best_bid_yes?: number | null
          created_at?: string
          eligible?: boolean
          id?: number
          ineligible_reason?: string | null
          last_price_yes?: number | null
          last_tick_at?: string | null
          market_id?: string
          meta?: Json | null
          no_token_id?: string | null
          question?: string | null
          slot_end_ms?: number
          slot_start_ms?: number
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          yes_token_id?: string | null
        }
        Relationships: []
      }
      engine_events: {
        Row: {
          correlation_id: string | null
          created_at: string
          duration_ms: number | null
          engine_instance_id: string | null
          event_type: string
          execution_id: string | null
          id: number
          instance_id: string | null
          message: string | null
          metadata: Json | null
          severity: string
          source: string
          timestamp: string
          user_id: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          engine_instance_id?: string | null
          event_type: string
          execution_id?: string | null
          id?: number
          instance_id?: string | null
          message?: string | null
          metadata?: Json | null
          severity?: string
          source?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          engine_instance_id?: string | null
          event_type?: string
          execution_id?: string | null
          id?: number
          instance_id?: string | null
          message?: string | null
          metadata?: Json | null
          severity?: string
          source?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      engine_feed_status: {
        Row: {
          detail: Json | null
          feed: string
          last_message_at: string | null
          latency_ms: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          detail?: Json | null
          feed: string
          last_message_at?: string | null
          latency_ms?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          detail?: Json | null
          feed?: string
          last_message_at?: string | null
          latency_ms?: number | null
          status?: string
          updated_at?: string
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
      engine_instances: {
        Row: {
          active_strategy: string | null
          cpu_percent: number | null
          current_market_id: string | null
          deployed_at: string | null
          engine_mode: string
          engine_status: string
          engine_version: string | null
          git_commit: string | null
          heartbeat_latency_ms: number | null
          host_name: string | null
          id: string
          instance_id: string
          instance_name: string | null
          last_heartbeat: string | null
          last_restart_at: string | null
          memory_total_mb: number | null
          memory_used_mb: number | null
          meta: Json | null
          region: string | null
          registered_at: string
          restart_count: number
          uptime_seconds: number | null
          user_id: string
        }
        Insert: {
          active_strategy?: string | null
          cpu_percent?: number | null
          current_market_id?: string | null
          deployed_at?: string | null
          engine_mode?: string
          engine_status?: string
          engine_version?: string | null
          git_commit?: string | null
          heartbeat_latency_ms?: number | null
          host_name?: string | null
          id?: string
          instance_id: string
          instance_name?: string | null
          last_heartbeat?: string | null
          last_restart_at?: string | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          meta?: Json | null
          region?: string | null
          registered_at?: string
          restart_count?: number
          uptime_seconds?: number | null
          user_id: string
        }
        Update: {
          active_strategy?: string | null
          cpu_percent?: number | null
          current_market_id?: string | null
          deployed_at?: string | null
          engine_mode?: string
          engine_status?: string
          engine_version?: string | null
          git_commit?: string | null
          heartbeat_latency_ms?: number | null
          host_name?: string | null
          id?: string
          instance_id?: string
          instance_name?: string | null
          last_heartbeat?: string | null
          last_restart_at?: string | null
          memory_total_mb?: number | null
          memory_used_mb?: number | null
          meta?: Json | null
          region?: string | null
          registered_at?: string
          restart_count?: number
          uptime_seconds?: number | null
          user_id?: string
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
      notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          body: string | null
          category: string
          created_at: string
          expires_at: string | null
          id: number
          metadata: Json | null
          read_at: string | null
          requires_ack: boolean
          resolved_at: string | null
          severity: string
          source: string
          title: string
          ts_ms: number
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          category?: string
          created_at?: string
          expires_at?: string | null
          id?: number
          metadata?: Json | null
          read_at?: string | null
          requires_ack?: boolean
          resolved_at?: string | null
          severity?: string
          source?: string
          title: string
          ts_ms?: number
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          body?: string | null
          category?: string
          created_at?: string
          expires_at?: string | null
          id?: number
          metadata?: Json | null
          read_at?: string | null
          requires_ack?: boolean
          resolved_at?: string | null
          severity?: string
          source?: string
          title?: string
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
          execution_id: string | null
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
          execution_id?: string | null
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
          execution_id?: string | null
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
      standing_order_events: {
        Row: {
          created_at: string
          created_by: string
          engine_instance_id: string | null
          event: string
          execution_id: string | null
          id: number
          latency_ms: number | null
          message: string | null
          metadata: Json | null
          phase: string
          standing_order_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          engine_instance_id?: string | null
          event: string
          execution_id?: string | null
          id?: number
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          phase: string
          standing_order_id: string
          timestamp?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          engine_instance_id?: string | null
          event?: string
          execution_id?: string | null
          id?: number
          latency_ms?: number | null
          message?: string | null
          metadata?: Json | null
          phase?: string
          standing_order_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_order_events_standing_order_id_fkey"
            columns: ["standing_order_id"]
            isOneToOne: false
            referencedRelation: "standing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_orders: {
        Row: {
          active_market_id: string | null
          created_at: string
          exchange_order_id: string | null
          execution_completed_at: string | null
          execution_id: string | null
          execution_started_at: string | null
          execution_window_end: string | null
          execution_window_start: string | null
          final_status: string | null
          id: string
          last_error: string | null
          last_market_roll_at: string | null
          majority_side_at_trigger:
            | Database["public"]["Enums"]["trade_side"]
            | null
          market_id: string | null
          market_roll_count: number
          max_retries: number
          mode: Database["public"]["Enums"]["pipeline_mode"]
          name: string
          notes: string | null
          order_intent_id: number | null
          position_size: number
          retry_count: number
          risk_profile: string
          selected_side: Database["public"]["Enums"]["trade_side"] | null
          status: string
          strategy_profile_id: number | null
          target_buy_price: number
          trigger_detected_at: string | null
          trigger_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_market_id?: string | null
          created_at?: string
          exchange_order_id?: string | null
          execution_completed_at?: string | null
          execution_id?: string | null
          execution_started_at?: string | null
          execution_window_end?: string | null
          execution_window_start?: string | null
          final_status?: string | null
          id?: string
          last_error?: string | null
          last_market_roll_at?: string | null
          majority_side_at_trigger?:
            | Database["public"]["Enums"]["trade_side"]
            | null
          market_id?: string | null
          market_roll_count?: number
          max_retries?: number
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          name: string
          notes?: string | null
          order_intent_id?: number | null
          position_size: number
          retry_count?: number
          risk_profile?: string
          selected_side?: Database["public"]["Enums"]["trade_side"] | null
          status?: string
          strategy_profile_id?: number | null
          target_buy_price: number
          trigger_detected_at?: string | null
          trigger_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_market_id?: string | null
          created_at?: string
          exchange_order_id?: string | null
          execution_completed_at?: string | null
          execution_id?: string | null
          execution_started_at?: string | null
          execution_window_end?: string | null
          execution_window_start?: string | null
          final_status?: string | null
          id?: string
          last_error?: string | null
          last_market_roll_at?: string | null
          majority_side_at_trigger?:
            | Database["public"]["Enums"]["trade_side"]
            | null
          market_id?: string | null
          market_roll_count?: number
          max_retries?: number
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          name?: string
          notes?: string | null
          order_intent_id?: number | null
          position_size?: number
          retry_count?: number
          risk_profile?: string
          selected_side?: Database["public"]["Enums"]["trade_side"] | null
          status?: string
          strategy_profile_id?: number | null
          target_buy_price?: number
          trigger_detected_at?: string | null
          trigger_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_orders_order_intent_id_fkey"
            columns: ["order_intent_id"]
            isOneToOne: false
            referencedRelation: "order_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_orders_strategy_profile_id_fkey"
            columns: ["strategy_profile_id"]
            isOneToOne: false
            referencedRelation: "strategy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_profile_versions: {
        Row: {
          change_summary: string
          config: Json
          created_at: string
          default_mode: string
          description: string
          enabled: boolean
          id: number
          name: string
          notes: string
          profile_id: number
          strategy_type: string
          tags: string[]
          user_id: string
          version: number
        }
        Insert: {
          change_summary?: string
          config: Json
          created_at?: string
          default_mode: string
          description?: string
          enabled: boolean
          id?: number
          name: string
          notes?: string
          profile_id: number
          strategy_type: string
          tags?: string[]
          user_id: string
          version: number
        }
        Update: {
          change_summary?: string
          config?: Json
          created_at?: string
          default_mode?: string
          description?: string
          enabled?: boolean
          id?: number
          name?: string
          notes?: string
          profile_id?: number
          strategy_type?: string
          tags?: string[]
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_profile_versions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "strategy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_profiles: {
        Row: {
          config: Json
          created_at: string
          created_at_ms: number
          default_mode: string
          description: string
          enabled: boolean
          id: number
          is_active: boolean
          last_used_at_ms: number | null
          name: string
          notes: string
          status: string
          strategy_type: string
          tags: string[]
          updated_at: string
          updated_at_ms: number
          user_id: string
          version: number
        }
        Insert: {
          config: Json
          created_at?: string
          created_at_ms: number
          default_mode?: string
          description?: string
          enabled?: boolean
          id?: number
          is_active?: boolean
          last_used_at_ms?: number | null
          name: string
          notes?: string
          status?: string
          strategy_type?: string
          tags?: string[]
          updated_at?: string
          updated_at_ms: number
          user_id: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          created_at_ms?: number
          default_mode?: string
          description?: string
          enabled?: boolean
          id?: number
          is_active?: boolean
          last_used_at_ms?: number | null
          name?: string
          notes?: string
          status?: string
          strategy_type?: string
          tags?: string[]
          updated_at?: string
          updated_at_ms?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      trades: {
        Row: {
          balance_after: number
          contract_end_ms: number | null
          contract_start_ms: number | null
          cost: number
          created_at: string
          down_token_id: string | null
          dust_saved: number
          engine_instance_id: string | null
          entry_at_ms: number | null
          event_id: string | null
          execution_id: string | null
          execution_latency_ms: number | null
          explanation: Json | null
          fees: number | null
          id: number
          majority_side_at_trigger: string | null
          mark_price: number | null
          market_id: string
          market_snapshot: Json | null
          mode: Database["public"]["Enums"]["pipeline_mode"]
          order_id: string | null
          pnl: number
          price: number
          question: string | null
          reconciliation_status: string | null
          resolution_at: string | null
          result: Database["public"]["Enums"]["trade_result"]
          settled_at: string | null
          settlement_status: string | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          slot_end_ms: number
          slug: string | null
          status: Database["public"]["Enums"]["trade_status"]
          target_buy_price: number | null
          trade_uid: string | null
          trigger_price: number | null
          unrealized_pnl: number | null
          up_token_id: string | null
          user_id: string
        }
        Insert: {
          balance_after?: number
          contract_end_ms?: number | null
          contract_start_ms?: number | null
          cost: number
          created_at?: string
          down_token_id?: string | null
          dust_saved?: number
          engine_instance_id?: string | null
          entry_at_ms?: number | null
          event_id?: string | null
          execution_id?: string | null
          execution_latency_ms?: number | null
          explanation?: Json | null
          fees?: number | null
          id?: number
          majority_side_at_trigger?: string | null
          mark_price?: number | null
          market_id: string
          market_snapshot?: Json | null
          mode: Database["public"]["Enums"]["pipeline_mode"]
          order_id?: string | null
          pnl?: number
          price: number
          question?: string | null
          reconciliation_status?: string | null
          resolution_at?: string | null
          result?: Database["public"]["Enums"]["trade_result"]
          settled_at?: string | null
          settlement_status?: string | null
          shares: number
          side: Database["public"]["Enums"]["trade_side"]
          slot_end_ms: number
          slug?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          target_buy_price?: number | null
          trade_uid?: string | null
          trigger_price?: number | null
          unrealized_pnl?: number | null
          up_token_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          contract_end_ms?: number | null
          contract_start_ms?: number | null
          cost?: number
          created_at?: string
          down_token_id?: string | null
          dust_saved?: number
          engine_instance_id?: string | null
          entry_at_ms?: number | null
          event_id?: string | null
          execution_id?: string | null
          execution_latency_ms?: number | null
          explanation?: Json | null
          fees?: number | null
          id?: number
          majority_side_at_trigger?: string | null
          mark_price?: number | null
          market_id?: string
          market_snapshot?: Json | null
          mode?: Database["public"]["Enums"]["pipeline_mode"]
          order_id?: string | null
          pnl?: number
          price?: number
          question?: string | null
          reconciliation_status?: string | null
          resolution_at?: string | null
          result?: Database["public"]["Enums"]["trade_result"]
          settled_at?: string | null
          settlement_status?: string | null
          shares?: number
          side?: Database["public"]["Enums"]["trade_side"]
          slot_end_ms?: number
          slug?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          target_buy_price?: number | null
          trade_uid?: string | null
          trigger_price?: number | null
          unrealized_pnl?: number | null
          up_token_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_engine_instance_id_fkey"
            columns: ["engine_instance_id"]
            isOneToOne: false
            referencedRelation: "engine_instances"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_state: {
        Row: {
          available_usdc: number
          balance_usdc: number
          locked_usdc: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_usdc?: number
          balance_usdc?: number
          locked_usdc?: number
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_usdc?: number
          balance_usdc?: number
          locked_usdc?: number
          source?: string
          updated_at?: string
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
