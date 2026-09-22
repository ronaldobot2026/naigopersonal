// Gerado por `supabase gen types typescript --linked` — NÃO EDITAR À MÃO.
// Regenerar após qualquer migration nova em `supabase/migrations/`.
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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assessment_photos: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          storage_path: string
          student_id: string
          view: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          storage_path: string
          student_id: string
          view: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          storage_path?: string
          student_id?: string
          view?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_photos_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "physical_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_photos_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_plan_items: {
        Row: {
          exercise_id: string
          exercise_name: string
          finding_id: string
          id: string
          origin: string
          plan_id: string
          reps: string
          sets: number
          target_muscles: string[]
          trainer_note: string | null
          validation: string
        }
        Insert: {
          exercise_id: string
          exercise_name: string
          finding_id: string
          id?: string
          origin: string
          plan_id: string
          reps: string
          sets: number
          target_muscles?: string[]
          trainer_note?: string | null
          validation?: string
        }
        Update: {
          exercise_id?: string
          exercise_name?: string
          finding_id?: string
          id?: string
          origin?: string
          plan_id?: string
          reps?: string
          sets?: number
          target_muscles?: string[]
          trainer_note?: string | null
          validation?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "corrective_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      // corrective_plans / corrective_plan_items: adicionadas à mão (supabase gen types precisa
      // de CLI autenticado/linkado, indisponível neste ambiente) a partir de
      // supabase/migrations/20260922120000_corrective_plans.sql. Regenerar via
      // `supabase gen types typescript --linked` assim que houver acesso, para substituir por
      // esta entrada gerada de verdade.
      corrective_plans: {
        Row: {
          assessment_id: string
          created_at: string
          evaluator_id: string
          findings: Json
          id: string
          prescription_version: string
          published_at: string | null
          status: string
          student_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          evaluator_id: string
          findings?: Json
          id?: string
          prescription_version: string
          published_at?: string | null
          status?: string
          student_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          evaluator_id?: string
          findings?: Json
          id?: string
          prescription_version?: string
          published_at?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_plans_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "physical_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_plans_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      body_metrics: {
        Row: {
          assessment_id: string | null
          body_fat_percent: number | null
          calves_cm: number | null
          chest_cm: number | null
          created_at: string
          height_cm: number | null
          hip_cm: number | null
          id: string
          left_arm_cm: number | null
          left_thigh_cm: number | null
          muscle_mass_kg: number | null
          recorded_at: string
          right_arm_cm: number | null
          right_thigh_cm: number | null
          student_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          assessment_id?: string | null
          body_fat_percent?: number | null
          calves_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          muscle_mass_kg?: number | null
          recorded_at?: string
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          student_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          assessment_id?: string | null
          body_fat_percent?: number | null
          calves_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          muscle_mass_kg?: number | null
          recorded_at?: string
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          student_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "physical_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      physical_assessments: {
        Row: {
          created_at: string
          evaluator_id: string
          general_notes: string | null
          id: string
          postural_assessment: Json | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluator_id: string
          general_notes?: string | null
          id?: string
          postural_assessment?: Json | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluator_id?: string
          general_notes?: string | null
          id?: string
          postural_assessment?: Json | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physical_assessments_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physical_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          birth_date: string | null
          created_at: string
          goals: string | null
          id: string
          restrictions: string | null
          sex: string | null
          started_at: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          goals?: string | null
          id: string
          restrictions?: string | null
          sex?: string | null
          started_at?: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          goals?: string | null
          id?: string
          restrictions?: string | null
          sex?: string | null
          started_at?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_my_student: { Args: { target_student_id: string }; Returns: boolean }
    }
    Enums: {
      user_role: "trainer" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["trainer", "student"],
    },
  },
} as const
