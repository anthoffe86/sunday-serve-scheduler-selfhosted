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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["service_role"]
          service_id: string
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["service_role"]
          service_id: string
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["service_role"]
          service_id?: string
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "sunday_services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          available: boolean
          created_at: string
          date: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_assignments: {
        Row: {
          created_at: string
          event_id: string
          id: string
          role: Database["public"]["Enums"]["service_role"]
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          role: Database["public"]["Enums"]["service_role"]
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          role?: Database["public"]["Enums"]["service_role"]
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_roles: {
        Row: {
          created_at: string
          event_id: string
          id: string
          quantity: number
          role: Database["public"]["Enums"]["service_role"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          quantity?: number
          role: Database["public"]["Enums"]["service_role"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          quantity?: number
          role?: Database["public"]["Enums"]["service_role"]
        }
        Relationships: [
          {
            foreignKeyName: "event_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_template_roles: {
        Row: {
          created_at: string
          id: string
          quantity: number
          role: Database["public"]["Enums"]["service_role"]
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity?: number
          role: Database["public"]["Enums"]["service_role"]
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          role?: Database["public"]["Enums"]["service_role"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_template_roles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          day_of_week: number
          description: string | null
          id: string
          is_recurring: boolean
          name: string
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_end_type: string | null
          recurrence_pattern: string | null
          start_date: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          day_of_week: number
          description?: string | null
          id?: string
          is_recurring?: boolean
          name: string
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_end_type?: string | null
          recurrence_pattern?: string | null
          start_date?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          description?: string | null
          id?: string
          is_recurring?: boolean
          name?: string
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_end_type?: string | null
          recurrence_pattern?: string | null
          start_date?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
          notes: string | null
          reading: string | null
          start_time: string
          status: string
          subheading: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
          notes?: string | null
          reading?: string | null
          start_time: string
          status?: string
          subheading?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
          notes?: string | null
          reading?: string | null
          start_time?: string
          status?: string
          subheading?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invite_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          name: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          family_group_id: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          family_group_id?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          family_group_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_family_group"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      role_preferences: {
        Row: {
          created_at: string
          id: string
          preference_order: number
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_order?: number
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_order?: number
          role?: Database["public"]["Enums"]["service_role"]
          user_id?: string
        }
        Relationships: []
      }
      service_history: {
        Row: {
          created_at: string
          date: string
          id: string
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          role?: Database["public"]["Enums"]["service_role"]
          user_id?: string
        }
        Relationships: []
      }
      sunday_services: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: []
      }
      swap_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignment_id: string | null
          created_at: string
          event_assignment_id: string | null
          from_user_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["swap_status"]
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          created_at?: string
          event_assignment_id?: string | null
          from_user_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string | null
          created_at?: string
          event_assignment_id?: string | null
          from_user_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["swap_status"]
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_event_assignment_id_fkey"
            columns: ["event_assignment_id"]
            isOneToOne: false
            referencedRelation: "event_assignments"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_same_family: {
        Args: { _user_id1: string; _user_id2: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "volunteer" | "admin"
      schedule_status: "draft" | "published"
      service_role:
        | "sidesman-standard"
        | "sidesman-sound"
        | "sidesman-welcome"
        | "reader"
        | "intercessions"
        | "collection"
      swap_status: "pending" | "approved" | "denied"
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
      app_role: ["volunteer", "admin"],
      schedule_status: ["draft", "published"],
      service_role: [
        "sidesman-standard",
        "sidesman-sound",
        "sidesman-welcome",
        "reader",
        "intercessions",
        "collection",
      ],
      swap_status: ["pending", "approved", "denied"],
    },
  },
} as const
