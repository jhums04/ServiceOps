export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          organization_id: string;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          street: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          street?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount_cents: number;
          currency: string;
          due_on: string;
          id: string;
          issued_at: string;
          job_id: string;
          line_description: string;
          number: number;
          organization_id: string;
          paid_at: string | null;
          public_token: string;
          status: Database["public"]["Enums"]["invoice_status"];
          voided_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          currency?: string;
          due_on: string;
          id?: string;
          issued_at?: string;
          job_id: string;
          line_description: string;
          number: number;
          organization_id: string;
          paid_at?: string | null;
          public_token?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          voided_at?: string | null;
        };
        Update: {
          amount_cents?: number;
          currency?: string;
          due_on?: string;
          id?: string;
          issued_at?: string;
          job_id?: string;
          line_description?: string;
          number?: number;
          organization_id?: string;
          paid_at?: string | null;
          public_token?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_job_id_fkey";
            columns: ["organization_id", "job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      jobs: {
        Row: {
          completed_at: string | null;
          completion_notes: string | null;
          created_at: string;
          customer_id: string;
          description: string | null;
          ends_at: string;
          id: string;
          organization_id: string;
          price_cents: number;
          service: string;
          started_at: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["job_status"];
          technician_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          customer_id: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          organization_id: string;
          price_cents: number;
          service: string;
          started_at?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["job_status"];
          technician_id?: string | null;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          completion_notes?: string | null;
          created_at?: string;
          customer_id?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          organization_id?: string;
          price_cents?: number;
          service?: string;
          started_at?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["job_status"];
          technician_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_customer_id_fkey";
            columns: ["organization_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_summaries";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "jobs_organization_id_customer_id_fkey";
            columns: ["organization_id", "customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_organization_id_technician_id_fkey";
            columns: ["organization_id", "technician_id"];
            isOneToOne: false;
            referencedRelation: "organization_members";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          organization_id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["member_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          organization_id: string;
          phone?: string | null;
          role: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          organization_id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          next_invoice_number: number;
          time_zone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          next_invoice_number?: number;
          time_zone: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          next_invoice_number?: number;
          time_zone?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          invoice_id: string;
          organization_id: string;
          paid_at: string;
          stripe_checkout_session_id: string;
          stripe_payment_intent_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency: string;
          id?: string;
          invoice_id: string;
          organization_id: string;
          paid_at: string;
          stripe_checkout_session_id: string;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          invoice_id?: string;
          organization_id?: string;
          paid_at?: string;
          stripe_checkout_session_id?: string;
          stripe_payment_intent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_invoice_id_fkey";
            columns: ["organization_id", "invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          processed_at: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      activity_feed: {
        Row: {
          amount_cents: number | null;
          customer_name: string | null;
          invoice_id: string | null;
          invoice_number: number | null;
          job_id: string | null;
          kind: string | null;
          occurred_at: string | null;
          organization_id: string | null;
          service: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      customer_summaries: {
        Row: {
          city: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          organization_id: string;
          outstanding_cents: number | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          street: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      create_invoice: { Args: { p_job_id: string }; Returns: string };
      dashboard_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          completed_jobs: number;
          outstanding_cents: number;
          outstanding_count: number;
          overdue_count: number;
          payment_count: number;
          revenue_cents: number;
          upcoming_jobs: number;
        }[];
      };
      get_public_invoice: {
        Args: { p_token: string };
        Returns: {
          amount_cents: number;
          currency: string;
          customer_city: string;
          customer_email: string;
          customer_name: string;
          customer_postal_code: string;
          customer_state: string;
          customer_street: string;
          due_on: string;
          id: string;
          issued_at: string;
          line_description: string;
          number: number;
          organization_name: string;
          organization_time_zone: string;
          paid_at: string;
          status: Database["public"]["Enums"]["invoice_status"];
        }[];
      };
      record_stripe_payment: {
        Args: {
          p_amount_cents?: number;
          p_checkout_session_id: string;
          p_currency?: string;
          p_event_id: string;
          p_event_type: string;
          p_invoice_id: string;
          p_payment_intent_id?: string;
          p_payment_status: string;
        };
        Returns: string;
      };
      reset_demo_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      revenue_series: {
        Args: { p_bucket: string; p_from: string; p_to: string };
        Returns: {
          bucket_start: string;
          revenue_cents: number;
        }[];
      };
      update_job_status: {
        Args: {
          p_job_id: string;
          p_notes?: string;
          p_status: Database["public"]["Enums"]["job_status"];
        };
        Returns: undefined;
      };
      void_invoice: { Args: { p_invoice_id: string }; Returns: undefined };
    };
    Enums: {
      invoice_status: "unpaid" | "paid" | "void";
      job_status: "scheduled" | "in_progress" | "completed" | "cancelled";
      member_role: "admin" | "technician";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      invoice_status: ["unpaid", "paid", "void"],
      job_status: ["scheduled", "in_progress", "completed", "cancelled"],
      member_role: ["admin", "technician"],
    },
  },
} as const;
