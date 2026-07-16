export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      bill_contents: {
        Row: {
          bill_id: string
          content: string
          created_at: string
          difficulty_level: Database["public"]["Enums"]["difficulty_level_enum"]
          id: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          bill_id: string
          content: string
          created_at?: string
          difficulty_level: Database["public"]["Enums"]["difficulty_level_enum"]
          id?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          bill_id?: string
          content?: string
          created_at?: string
          difficulty_level?: Database["public"]["Enums"]["difficulty_level_enum"]
          id?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_contents_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_member_votes: {
        Row: {
          bill_id: string
          created_at: string
          member_id: string
          seat_number: number
          source_label: string | null
          source_url: string | null
          updated_at: string
          vote_type: Database["public"]["Enums"]["bill_vote_type_enum"]
        }
        Insert: {
          bill_id: string
          created_at?: string
          member_id: string
          seat_number: number
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
          vote_type: Database["public"]["Enums"]["bill_vote_type_enum"]
        }
        Update: {
          bill_id?: string
          created_at?: string
          member_id?: string
          seat_number?: number
          source_label?: string | null
          source_url?: string | null
          updated_at?: string
          vote_type?: Database["public"]["Enums"]["bill_vote_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "bill_member_votes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_member_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          created_at: string
          diet_session_id: string | null
          document_type: Database["public"]["Enums"]["document_type_enum"]
          id: string
          is_featured: boolean
          name: string
          originating_house: Database["public"]["Enums"]["house_enum"]
          proposer_member_id: string | null
          publish_status: Database["public"]["Enums"]["bill_publish_status"]
          publish_status_order: number | null
          published_at: string | null
          share_thumbnail_url: string | null
          shugiin_url: string | null
          status: Database["public"]["Enums"]["bill_status_enum"]
          status_note: string | null
          status_order: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diet_session_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type_enum"]
          id?: string
          is_featured?: boolean
          name: string
          originating_house: Database["public"]["Enums"]["house_enum"]
          proposer_member_id?: string | null
          publish_status?: Database["public"]["Enums"]["bill_publish_status"]
          publish_status_order?: number | null
          published_at?: string | null
          share_thumbnail_url?: string | null
          shugiin_url?: string | null
          status: Database["public"]["Enums"]["bill_status_enum"]
          status_note?: string | null
          status_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diet_session_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type_enum"]
          id?: string
          is_featured?: boolean
          name?: string
          originating_house?: Database["public"]["Enums"]["house_enum"]
          proposer_member_id?: string | null
          publish_status?: Database["public"]["Enums"]["bill_publish_status"]
          publish_status_order?: number | null
          published_at?: string | null
          share_thumbnail_url?: string | null
          shugiin_url?: string | null
          status?: Database["public"]["Enums"]["bill_status_enum"]
          status_note?: string | null
          status_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_diet_session_id_fkey"
            columns: ["diet_session_id"]
            isOneToOne: false
            referencedRelation: "diet_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_proposer_member_id_fkey"
            columns: ["proposer_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_tags: {
        Row: {
          bill_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_tags_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_usage_events: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          occurred_at: string
          output_tokens: number
          prompt_name: string | null
          session_id: string | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model: string
          occurred_at?: string
          output_tokens?: number
          prompt_name?: string | null
          session_id?: string | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          occurred_at?: string
          output_tokens?: number
          prompt_name?: string | null
          session_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          message: string
          role: Database["public"]["Enums"]["chat_role_enum"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          message: string
          role: Database["public"]["Enums"]["chat_role_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          message?: string
          role?: Database["public"]["Enums"]["chat_role_enum"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      council_action_bills: {
        Row: {
          bill_id: string
          council_action_id: string
          created_at: string
          id: string
        }
        Insert: {
          bill_id: string
          council_action_id: string
          created_at?: string
          id?: string
        }
        Update: {
          bill_id?: string
          council_action_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_action_bills_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_action_bills_council_action_id_fkey"
            columns: ["council_action_id"]
            isOneToOne: false
            referencedRelation: "council_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      council_actions: {
        Row: {
          action_date: string
          created_at: string
          description: string
          destination_body: string | null
          destination_name: string
          destination_role: string | null
          id: string
          image_url: string | null
          kind: string
          official_url: string | null
          slug: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_date: string
          created_at?: string
          description?: string
          destination_body?: string | null
          destination_name: string
          destination_role?: string | null
          id?: string
          image_url?: string | null
          kind: string
          official_url?: string | null
          slug: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_date?: string
          created_at?: string
          description?: string
          destination_body?: string | null
          destination_name?: string
          destination_role?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          official_url?: string | null
          slug?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      diet_sessions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          shugiin_url: string | null
          slug: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          shugiin_url?: string | null
          slug?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          shugiin_url?: string | null
          slug?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      expert_registrations: {
        Row: {
          affiliation: string
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliation: string
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliation?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      general_question_items: {
        Row: {
          city_answer_summaries: Json
          confirmed_facts: string[]
          created_at: string
          general_question_id: string
          id: string
          item_number: number
          sub_items: string[]
          title: string
          updated_at: string
        }
        Insert: {
          city_answer_summaries?: Json
          confirmed_facts?: string[]
          created_at?: string
          general_question_id: string
          id?: string
          item_number: number
          sub_items?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          city_answer_summaries?: Json
          confirmed_facts?: string[]
          created_at?: string
          general_question_id?: string
          id?: string
          item_number?: number
          sub_items?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_question_items_general_question_id_fkey"
            columns: ["general_question_id"]
            isOneToOne: false
            referencedRelation: "general_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      general_questions: {
        Row: {
          created_at: string
          diet_session_id: string
          id: string
          member_id: string
          member_name_raw: string | null
          question_date: string
          question_number: number
          seat_type: string
          slug: string
          source_kind: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          diet_session_id: string
          id?: string
          member_id: string
          member_name_raw?: string | null
          question_date: string
          question_number: number
          seat_type: string
          slug: string
          source_kind?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          diet_session_id?: string
          id?: string
          member_id?: string
          member_name_raw?: string | null
          question_date?: string
          question_number?: number
          seat_type?: string
          slug?: string
          source_kind?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "general_questions_diet_session_id_fkey"
            columns: ["diet_session_id"]
            isOneToOne: false
            referencedRelation: "diet_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "general_questions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_configs: {
        Row: {
          bill_id: string
          chat_model: string | null
          created_at: string
          estimated_duration: number | null
          id: string
          knowledge_source: string | null
          mode: Database["public"]["Enums"]["interview_mode_enum"]
          name: string
          status: Database["public"]["Enums"]["interview_config_status_enum"]
          themes: string[] | null
          updated_at: string
        }
        Insert: {
          bill_id: string
          chat_model?: string | null
          created_at?: string
          estimated_duration?: number | null
          id?: string
          knowledge_source?: string | null
          mode?: Database["public"]["Enums"]["interview_mode_enum"]
          name: string
          status?: Database["public"]["Enums"]["interview_config_status_enum"]
          themes?: string[] | null
          updated_at?: string
        }
        Update: {
          bill_id?: string
          chat_model?: string | null
          created_at?: string
          estimated_duration?: number | null
          id?: string
          knowledge_source?: string | null
          mode?: Database["public"]["Enums"]["interview_mode_enum"]
          name?: string
          status?: Database["public"]["Enums"]["interview_config_status_enum"]
          themes?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_configs_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          interview_session_id: string
          role: Database["public"]["Enums"]["interview_role_enum"]
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          interview_session_id: string
          role: Database["public"]["Enums"]["interview_role_enum"]
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          interview_session_id?: string
          role?: Database["public"]["Enums"]["interview_role_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "interview_messages_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          created_at: string
          follow_up_guide: string | null
          id: string
          interview_config_id: string
          question: string
          question_order: number
          quick_replies: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          follow_up_guide?: string | null
          id?: string
          interview_config_id: string
          question: string
          question_order: number
          quick_replies?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          follow_up_guide?: string | null
          id?: string
          interview_config_id?: string
          question?: string
          question_order?: number
          quick_replies?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_interview_config_id_fkey"
            columns: ["interview_config_id"]
            isOneToOne: false
            referencedRelation: "interview_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_rating_feedbacks: {
        Row: {
          created_at: string
          id: string
          interview_session_id: string
          tag: Database["public"]["Enums"]["interview_feedback_tag_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          interview_session_id: string
          tag: Database["public"]["Enums"]["interview_feedback_tag_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          interview_session_id?: string
          tag?: Database["public"]["Enums"]["interview_feedback_tag_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "interview_rating_feedbacks_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_report: {
        Row: {
          content_richness: Json | null
          created_at: string
          id: string
          interview_session_id: string
          is_public_by_admin: boolean
          is_public_by_user: boolean
          moderation_reasoning: string | null
          moderation_score: number | null
          moderation_status:
            | Database["public"]["Enums"]["moderation_status_enum"]
            | null
          opinions: Json | null
          role: Database["public"]["Enums"]["interview_report_role_enum"] | null
          role_description: string | null
          role_title: string | null
          stance: Database["public"]["Enums"]["stance_type_enum"] | null
          summary: string | null
          total_content_richness: number | null
          updated_at: string
        }
        Insert: {
          content_richness?: Json | null
          created_at?: string
          id?: string
          interview_session_id: string
          is_public_by_admin?: boolean
          is_public_by_user?: boolean
          moderation_reasoning?: string | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status_enum"]
            | null
          opinions?: Json | null
          role?:
            | Database["public"]["Enums"]["interview_report_role_enum"]
            | null
          role_description?: string | null
          role_title?: string | null
          stance?: Database["public"]["Enums"]["stance_type_enum"] | null
          summary?: string | null
          total_content_richness?: number | null
          updated_at?: string
        }
        Update: {
          content_richness?: Json | null
          created_at?: string
          id?: string
          interview_session_id?: string
          is_public_by_admin?: boolean
          is_public_by_user?: boolean
          moderation_reasoning?: string | null
          moderation_score?: number | null
          moderation_status?:
            | Database["public"]["Enums"]["moderation_status_enum"]
            | null
          opinions?: Json | null
          role?:
            | Database["public"]["Enums"]["interview_report_role_enum"]
            | null
          role_description?: string | null
          role_title?: string | null
          stance?: Database["public"]["Enums"]["stance_type_enum"] | null
          summary?: string | null
          total_content_richness?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_report_interview_session_id_fkey"
            columns: ["interview_session_id"]
            isOneToOne: true
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          interview_config_id: string
          langfuse_session_id: string | null
          rating: number | null
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interview_config_id: string
          langfuse_session_id?: string | null
          rating?: number | null
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interview_config_id?: string
          langfuse_session_id?: string | null
          rating?: number | null
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_interview_config_id_fkey"
            columns: ["interview_config_id"]
            isOneToOne: false
            referencedRelation: "interview_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      member_links: {
        Row: {
          created_at: string
          id: string
          label: string | null
          member_id: string
          service: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          member_id: string
          service: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          member_id?: string
          service?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          election_count: number | null
          facebook_url: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          line_url: string | null
          name: string
          name_kana: string | null
          party: string | null
          party_group: string | null
          threads_url: string | null
          twitter_url: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          election_count?: number | null
          facebook_url?: string | null
          id: string
          image_url?: string | null
          instagram_url?: string | null
          line_url?: string | null
          name: string
          name_kana?: string | null
          party?: string | null
          party_group?: string | null
          threads_url?: string | null
          twitter_url?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          election_count?: number | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          line_url?: string | null
          name?: string
          name_kana?: string | null
          party?: string | null
          party_group?: string | null
          threads_url?: string | null
          twitter_url?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      mirai_stances: {
        Row: {
          bill_id: string
          comment: string | null
          created_at: string
          id: string
          type: Database["public"]["Enums"]["stance_type_enum"]
          updated_at: string
        }
        Insert: {
          bill_id: string
          comment?: string | null
          created_at?: string
          id?: string
          type: Database["public"]["Enums"]["stance_type_enum"]
          updated_at?: string
        }
        Update: {
          bill_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          type?: Database["public"]["Enums"]["stance_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mirai_stances_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: true
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      preview_tokens: {
        Row: {
          bill_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          token: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "preview_tokens_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      report_reactions: {
        Row: {
          created_at: string
          id: string
          interview_report_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interview_report_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interview_report_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_reactions_interview_report_id_fkey"
            columns: ["interview_report_id"]
            isOneToOne: false
            referencedRelation: "interview_report"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          description: string | null
          featured_priority: number | null
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          featured_priority?: number | null
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          featured_priority?: number | null
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      topic_analysis_classifications: {
        Row: {
          id: string
          interview_report_id: string
          opinion_index: number
          topic_id: string
          version_id: string
        }
        Insert: {
          id?: string
          interview_report_id: string
          opinion_index: number
          topic_id: string
          version_id: string
        }
        Update: {
          id?: string
          interview_report_id?: string
          opinion_index?: number
          topic_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_analysis_classifications_interview_report_id_fkey"
            columns: ["interview_report_id"]
            isOneToOne: false
            referencedRelation: "interview_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_analysis_classifications_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topic_analysis_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_analysis_classifications_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "topic_analysis_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_analysis_topics: {
        Row: {
          created_at: string
          description_md: string
          id: string
          name: string
          representative_opinions: Json
          sort_order: number
          version_id: string
        }
        Insert: {
          created_at?: string
          description_md: string
          id?: string
          name: string
          representative_opinions?: Json
          sort_order?: number
          version_id: string
        }
        Update: {
          created_at?: string
          description_md?: string
          id?: string
          name?: string
          representative_opinions?: Json
          sort_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_analysis_topics_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "topic_analysis_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_analysis_versions: {
        Row: {
          bill_id: string
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          intermediate_results: Json | null
          phase_data: Json | null
          started_at: string | null
          status: string
          summary_md: string | null
          updated_at: string
          version: number
        }
        Insert: {
          bill_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          intermediate_results?: Json | null
          phase_data?: Json | null
          started_at?: string | null
          status?: string
          summary_md?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          bill_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          intermediate_results?: Json | null
          phase_data?: Json | null
          started_at?: string | null
          status?: string
          summary_md?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_analysis_versions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_bills: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_bills_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_bills_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_general_questions: {
        Row: {
          created_at: string
          general_question_id: string
          id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          general_question_id: string
          id?: string
          topic_id: string
        }
        Update: {
          created_at?: string
          general_question_id?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_general_questions_general_question_id_fkey"
            columns: ["general_question_id"]
            isOneToOne: false
            referencedRelation: "general_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_general_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_updates: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          published_at: string
          source_label: string | null
          source_url: string | null
          status_label: string | null
          summary: string
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          kind: string
          published_at?: string
          source_label?: string | null
          source_url?: string | null
          status_label?: string | null
          summary: string
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          published_at?: string
          source_label?: string | null
          source_url?: string | null
          status_label?: string | null
          summary?: string
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_updates_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          content: string
          content_hard: string | null
          created_at: string
          current_status_label: string | null
          current_status_note: string | null
          current_status_updated_at: string | null
          description: string
          id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          content_hard?: string | null
          created_at?: string
          current_status_label?: string | null
          current_status_note?: string | null
          current_status_updated_at?: string | null
          description: string
          id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_hard?: string | null
          created_at?: string
          current_status_label?: string | null
          current_status_note?: string | null
          current_status_updated_at?: string | null
          description?: string
          id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bulk_publish_reports: {
        Args: {
          p_config_id: string
          p_max_moderation_score: number
          p_min_content_richness: number
        }
        Returns: number
      }
      count_bulk_publish_targets: {
        Args: {
          p_config_id: string
          p_max_moderation_score: number
          p_min_content_richness: number
        }
        Returns: number
      }
      count_public_reports_by_stance: {
        Args: { p_bill_id: string }
        Returns: {
          count: number
          stance: string
        }[]
      }
      count_reactions_by_report_ids: {
        Args: { report_ids: string[] }
        Returns: {
          cnt: number
          interview_report_id: string
          reaction_type: string
        }[]
      }
      count_sessions_by_config_ids: {
        Args: { p_config_ids: string[] }
        Returns: {
          interview_config_id: string
          session_count: number
        }[]
      }
      find_public_reports_by_bill_id_ordered_by_reactions: {
        Args: {
          p_bill_id: string
          p_limit?: number
          p_offset?: number
          p_sort_order?: string
          p_stance?: string
        }
        Returns: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["interview_report_role_enum"]
          role_title: string
          stance: Database["public"]["Enums"]["stance_type_enum"]
          summary: string
          total_content_richness: number
        }[]
      }
      find_sessions_ordered_by_helpful_count: {
        Args: {
          p_ascending?: boolean
          p_config_id: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_stance?: string
          p_status?: string
          p_visibility?: string
        }
        Returns: {
          session_id: string
        }[]
      }
      find_sessions_ordered_by_message_count: {
        Args: {
          p_ascending?: boolean
          p_config_id: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_stance?: string
          p_status?: string
          p_visibility?: string
        }
        Returns: {
          session_id: string
        }[]
      }
      find_sessions_ordered_by_moderation_score: {
        Args: {
          p_ascending?: boolean
          p_config_id: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_stance?: string
          p_status?: string
          p_visibility?: string
        }
        Returns: {
          session_id: string
        }[]
      }
      find_sessions_ordered_by_total_content_richness: {
        Args: {
          p_ascending?: boolean
          p_config_id: string
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_stance?: string
          p_status?: string
          p_visibility?: string
        }
        Returns: {
          session_id: string
        }[]
      }
      get_admin_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          last_sign_in_at: string
        }[]
      }
      get_interview_message_counts: {
        Args: { session_ids: string[] }
        Returns: {
          interview_session_id: string
          message_count: number
        }[]
      }
      get_interview_statistics: {
        Args: { p_config_id: string }
        Returns: {
          avg_cost_usd: number
          avg_message_count: number
          avg_rating: number
          avg_total_content_richness: number
          completed_sessions: number
          feedback_irrelevant_questions: number
          feedback_misunderstood: number
          feedback_not_aligned: number
          feedback_other: number
          feedback_too_many_questions: number
          median_duration_seconds: number
          public_by_user_count: number
          role_daily_life_affected_count: number
          role_general_citizen_count: number
          role_subject_expert_count: number
          role_work_related_count: number
          stance_against_count: number
          stance_for_count: number
          stance_neutral_count: number
          total_cost_usd: number
          total_sessions: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      set_active_diet_session: {
        Args: { target_session_id: string }
        Returns: undefined
      }
      sum_chat_usage_cost: {
        Args: { from_iso: string; to_iso: string }
        Returns: number
      }
    }
    Enums: {
      bill_publish_status: "draft" | "published" | "coming_soon"
      bill_status_enum:
        | "introduced"
        | "in_originating_house"
        | "in_receiving_house"
        | "enacted"
        | "rejected"
        | "preparing"
      bill_vote_type_enum: "for" | "not_for" | "absent" | "left" | "chair"
      chat_role_enum: "user" | "system" | "assistant"
      difficulty_level_enum: "normal" | "hard"
      document_type_enum: "bill" | "speech" | "report" | "consent" | "approval"
      house_enum: "HR" | "HC"
      interview_config_status_enum: "public" | "closed"
      interview_feedback_tag_enum:
        | "irrelevant_questions"
        | "not_aligned"
        | "misunderstood"
        | "too_many_questions"
        | "other"
      interview_mode_enum: "loop" | "bulk"
      interview_report_role_enum:
        | "subject_expert"
        | "work_related"
        | "daily_life_affected"
        | "general_citizen"
      interview_role_enum: "assistant" | "user"
      moderation_status_enum: "ok" | "warning" | "ng"
      stance_type_enum:
        | "for"
        | "against"
        | "neutral"
        | "conditional_for"
        | "conditional_against"
        | "considering"
        | "continued_deliberation"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bill_publish_status: ["draft", "published", "coming_soon"],
      bill_status_enum: [
        "introduced",
        "in_originating_house",
        "in_receiving_house",
        "enacted",
        "rejected",
        "preparing",
      ],
      bill_vote_type_enum: ["for", "not_for", "absent", "left", "chair"],
      chat_role_enum: ["user", "system", "assistant"],
      difficulty_level_enum: ["normal", "hard"],
      document_type_enum: ["bill", "speech", "report", "consent", "approval"],
      house_enum: ["HR", "HC"],
      interview_config_status_enum: ["public", "closed"],
      interview_feedback_tag_enum: [
        "irrelevant_questions",
        "not_aligned",
        "misunderstood",
        "too_many_questions",
        "other",
      ],
      interview_mode_enum: ["loop", "bulk"],
      interview_report_role_enum: [
        "subject_expert",
        "work_related",
        "daily_life_affected",
        "general_citizen",
      ],
      interview_role_enum: ["assistant", "user"],
      moderation_status_enum: ["ok", "warning", "ng"],
      stance_type_enum: [
        "for",
        "against",
        "neutral",
        "conditional_for",
        "conditional_against",
        "considering",
        "continued_deliberation",
      ],
    },
  },
} as const
