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
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          organisation_name: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          organisation_name: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          organisation_name?: string
          status?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["service_role"]
          service_id: string
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string
          role: Database["public"]["Enums"]["service_role"]
          service_id: string
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["service_role"]
          service_id?: string
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
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
          org_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_assignments: {
        Row: {
          created_at: string
          decline_reason: string | null
          event_id: string
          id: string
          invitation_token: string | null
          invited_at: string | null
          org_id: string
          responded_at: string | null
          role: Database["public"]["Enums"]["service_role"]
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          event_id: string
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          org_id?: string
          responded_at?: string | null
          role: Database["public"]["Enums"]["service_role"]
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          event_id?: string
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          org_id?: string
          responded_at?: string | null
          role?: Database["public"]["Enums"]["service_role"]
          status?: Database["public"]["Enums"]["assignment_status"]
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
          {
            foreignKeyName: "event_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_roles: {
        Row: {
          created_at: string
          event_id: string
          id: string
          org_id: string
          quantity: number
          role: Database["public"]["Enums"]["service_role"]
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          org_id?: string
          quantity?: number
          role: Database["public"]["Enums"]["service_role"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          org_id?: string
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
          {
            foreignKeyName: "event_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_template_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          quantity: number
          role: Database["public"]["Enums"]["service_role"]
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string
          quantity?: number
          role: Database["public"]["Enums"]["service_role"]
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          quantity?: number
          role?: Database["public"]["Enums"]["service_role"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_template_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_end_type?: string | null
          recurrence_pattern?: string | null
          start_date?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          date: string
          id: string
          invitations_sent_at: string | null
          name: string
          notes: string | null
          org_id: string
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
          invitations_sent_at?: string | null
          name: string
          notes?: string | null
          org_id?: string
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
          invitations_sent_at?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          reading?: string | null
          start_time?: string
          status?: string
          subheading?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
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
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string
          org_id: string
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
          org_id?: string
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
          org_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      // Added by hand for migration 20260731100000_org_scoped_invites_and_settings.
      // Re-run `npx supabase gen types typescript --project-id <ref> --schema public`
      // once that migration is deployed and this block will be regenerated.
      org_notification_settings: {
        Row: {
          enabled: boolean
          key: string
          org_id: string
          updated_at: string
        }
        Insert: {
          enabled: boolean
          key: string
          org_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_notification_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_attempts: {
        Row: {
          email_hash: string
          id: string
          ip_hash: string | null
          requested_at: string
        }
        Insert: {
          email_hash: string
          id?: string
          ip_hash?: string | null
          requested_at?: string
        }
        Update: {
          email_hash?: string
          id?: string
          ip_hash?: string | null
          requested_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          calendar_feed_token: string | null
          created_at: string
          email: string
          family_group_id: string | null
          id: string
          name: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          calendar_feed_token?: string | null
          created_at?: string
          email: string
          family_group_id?: string | null
          id?: string
          name: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          calendar_feed_token?: string | null
          created_at?: string
          email?: string
          family_group_id?: string | null
          id?: string
          name?: string
          org_id?: string | null
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
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_preferences: {
        Row: {
          created_at: string
          id: string
          org_id: string
          preference_order: number
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string
          preference_order?: number
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          preference_order?: number
          role?: Database["public"]["Enums"]["service_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_history: {
        Row: {
          created_at: string
          date: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          org_id?: string
          role: Database["public"]["Enums"]["service_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["service_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_services: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          org_id: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sunday_services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
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
          offered_assignment_id: string | null
          org_id: string
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
          offered_assignment_id?: string | null
          org_id?: string
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
          offered_assignment_id?: string | null
          org_id?: string
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
          {
            foreignKeyName: "swap_requests_event_assignment_id_fkey"
            columns: ["event_assignment_id"]
            isOneToOne: false
            referencedRelation: "event_assignments_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_offered_assignment_id_fkey"
            columns: ["offered_assignment_id"]
            isOneToOne: false
            referencedRelation: "event_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_offered_assignment_id_fkey"
            columns: ["offered_assignment_id"]
            isOneToOne: false
            referencedRelation: "event_assignments_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_assignments_safe: {
        Row: {
          created_at: string | null
          decline_reason: string | null
          event_id: string | null
          id: string | null
          invitation_token: string | null
          invited_at: string | null
          responded_at: string | null
          role: Database["public"]["Enums"]["service_role"] | null
          status: Database["public"]["Enums"]["assignment_status"] | null
          updated_at: string | null
          volunteer_id: string | null
        }
        Insert: {
          created_at?: string | null
          decline_reason?: string | null
          event_id?: string | null
          id?: string | null
          invitation_token?: never
          invited_at?: string | null
          responded_at?: string | null
          role?: Database["public"]["Enums"]["service_role"] | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          updated_at?: string | null
          volunteer_id?: string | null
        }
        Update: {
          created_at?: string | null
          decline_reason?: string | null
          event_id?: string | null
          id?: string | null
          invitation_token?: never
          invited_at?: string | null
          responded_at?: string | null
          role?: Database["public"]["Enums"]["service_role"] | null
          status?: Database["public"]["Enums"]["assignment_status"] | null
          updated_at?: string | null
          volunteer_id?: string | null
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
    }
    Functions: {
      bootstrap_super_admin: { Args: never; Returns: string }
      current_user_org_id: { Args: { _user_id?: string }; Returns: string }
      get_default_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_event_published: { Args: { _event_id: string }; Returns: boolean }
      // Added by hand for migration 20260731100000_org_scoped_invites_and_settings.
      // Returns 'available' | 'in_org' | 'registered_elsewhere'.
      invite_email_status: { Args: { _email: string }; Returns: string }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_same_family: {
        Args: { _user_id1: string; _user_id2: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "volunteer" | "admin" | "super_admin"
      assignment_status: "proposed" | "invited" | "confirmed" | "declined"
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
      app_role: ["volunteer", "admin", "super_admin"],
      assignment_status: ["proposed", "invited", "confirmed", "declined"],
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
