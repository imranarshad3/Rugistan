
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            product_views: {
              Row: { product_id: string; session_key: string; viewed_at: string }
              Insert: { product_id: string; session_key: string; viewed_at?: string }
              Update: { product_id?: string; session_key?: string; viewed_at?: string }
              ComputedFields: never
              Relationships: []
            },

            "banners": {
                  Row: {
                    "created_at": string,"cta_label": string,"eyebrow": string,"id": string,"image_url": string | null,"is_active": boolean,"link_url": string,"placement": string,"sort_order": number,"subtitle": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"cta_label"?: string,"eyebrow"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"link_url"?: string,"placement"?: string,"sort_order"?: number,"subtitle"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"cta_label"?: string,"eyebrow"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"link_url"?: string,"placement"?: string,"sort_order"?: number,"subtitle"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"id": string,"product_id": string,"quantity": number,"updated_at": string,"user_id": string,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"product_id": string,"quantity"?: number,"updated_at"?: string,"user_id": string,"variant_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"product_id"?: string,"quantity"?: number,"updated_at"?: string,"user_id"?: string,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"image_url": string | null,"is_active": boolean,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"image_url"?: string | null,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"first_name": string,"id": string,"is_read": boolean,"last_name": string,"message": string,"phone": string,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"first_name": string,"id"?: string,"is_read"?: boolean,"last_name"?: string,"message": string,"phone"?: string,"topic"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"first_name"?: string,"id"?: string,"is_read"?: boolean,"last_name"?: string,"message"?: string,"phone"?: string,"topic"?: string
                  }
                  Relationships: [
                    
                  ]
                },"newsletter_subscribers": {
                  Row: {
                    "created_at": string,"email": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"order_events": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"note": string,"order_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"note"?: string,"order_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"note"?: string,"order_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "id": string,"image_url": string | null,"line_total": number,"order_id": string,"product_id": string | null,"product_name": string,"quantity": number,"size_label": string,"unit_price": number,"variant_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"image_url"?: string | null,"line_total": number,"order_id": string,"product_id"?: string | null,"product_name": string,"quantity": number,"size_label"?: string,"unit_price": number,"variant_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"image_url"?: string | null,"line_total"?: number,"order_id"?: string,"product_id"?: string | null,"product_name"?: string,"quantity"?: number,"size_label"?: string,"unit_price"?: number,"variant_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_variant_id_fkey"
      columns: ["variant_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address_line1": string,"address_line2": string,"admin_note": string,"city": string,"country": string,"created_at": string,"currency": string,"customer_note": string,"discount_amount": number,"email": string,"first_name": string,"id": string,"last_name": string,"order_number": string,"payment_method": string,"payment_status": Database["public"]['Enums']["payment_status"],"phone": string,"postal_code": string,"promo_code": string | null,"province": string,"shipping_amount": number,"shipping_method": string,"status": Database["public"]['Enums']["order_status"],"subtotal": number,"total": number,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address_line1": string,"address_line2"?: string,"admin_note"?: string,"city": string,"country": string,"created_at"?: string,"currency"?: string,"customer_note"?: string,"discount_amount"?: number,"email": string,"first_name": string,"id"?: string,"last_name": string,"order_number": string,"payment_method"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string,"postal_code"?: string,"promo_code"?: string | null,"province"?: string,"shipping_amount"?: number,"shipping_method"?: string,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "address_line1"?: string,"address_line2"?: string,"admin_note"?: string,"city"?: string,"country"?: string,"created_at"?: string,"currency"?: string,"customer_note"?: string,"discount_amount"?: number,"email"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"order_number"?: string,"payment_method"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string,"postal_code"?: string,"promo_code"?: string | null,"province"?: string,"shipping_amount"?: number,"shipping_method"?: string,"status"?: Database["public"]['Enums']["order_status"],"subtotal"?: number,"total"?: number,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"pages": {
                  Row: {
                    "content": string,"created_at": string,"hero_heading": string,"hero_image_url": string | null,"id": string,"is_system": boolean,"meta_description": string,"meta_title": string,"slug": string,"status": Database["public"]['Enums']["page_status"],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content"?: string,"created_at"?: string,"hero_heading"?: string,"hero_image_url"?: string | null,"id"?: string,"is_system"?: boolean,"meta_description"?: string,"meta_title"?: string,"slug": string,"status"?: Database["public"]['Enums']["page_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"hero_heading"?: string,"hero_image_url"?: string | null,"id"?: string,"is_system"?: boolean,"meta_description"?: string,"meta_title"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["page_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_images": {
                  Row: {
                    "alt": string,"created_at": string,"id": string,"product_id": string,"sort_order": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt"?: string,"created_at"?: string,"id"?: string,"product_id": string,"sort_order"?: number,"url": string
                  }
                  Update: {
                    "alt"?: string,"created_at"?: string,"id"?: string,"product_id"?: string,"sort_order"?: number,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_images_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "id": string,"is_active": boolean,"label": string,"price_delta": number,"product_id": string,"sort_order": number,"stock_quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"label": string,"price_delta"?: number,"product_id": string,"sort_order"?: number,"stock_quantity"?: number
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"label"?: string,"price_delta"?: number,"product_id"?: string,"sort_order"?: number,"stock_quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_id": string | null,"color": string,"colors": NonNullable<Json>,"compare_at_price": number | null,"created_at": string,"description": string,"dimensions": string,"id": string,"is_featured": boolean,"low_stock_at": number,"material": string,"name": string,"price": number,"rating_avg": number,"rating_count": number,"room": string,"short_description": string,"sku": string,"slug": string,"status": Database["public"]['Enums']["product_status"],"stock_quantity": number,"style": string,"updated_at": string,"weave_technique": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"color"?: string,"colors"?: NonNullable<Json>,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"dimensions"?: string,"id"?: string,"is_featured"?: boolean,"low_stock_at"?: number,"material"?: string,"name": string,"price": number,"rating_avg"?: number,"rating_count"?: number,"room"?: string,"short_description"?: string,"sku": string,"slug": string,"status"?: Database["public"]['Enums']["product_status"],"stock_quantity"?: number,"style"?: string,"updated_at"?: string,"weave_technique"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"color"?: string,"colors"?: NonNullable<Json>,"compare_at_price"?: number | null,"created_at"?: string,"description"?: string,"dimensions"?: string,"id"?: string,"is_featured"?: boolean,"low_stock_at"?: number,"material"?: string,"name"?: string,"price"?: number,"rating_avg"?: number,"rating_count"?: number,"room"?: string,"short_description"?: string,"sku"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["product_status"],"stock_quantity"?: number,"style"?: string,"updated_at"?: string,"weave_technique"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"email": string,"first_name": string,"id": string,"last_name": string,"phone": string,"role": Database["public"]['Enums']["user_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"email": string,"first_name"?: string,"id": string,"last_name"?: string,"phone"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"email"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"phone"?: string,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"promo_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string | null,"id": string,"is_active": boolean,"min_subtotal": number,"type": Database["public"]['Enums']["promo_type"],"usage_limit": number | null,"used_count": number,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"min_subtotal"?: number,"type"?: Database["public"]['Enums']["promo_type"],"usage_limit"?: number | null,"used_count"?: number,"value": number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_active"?: boolean,"min_subtotal"?: number,"type"?: Database["public"]['Enums']["promo_type"],"usage_limit"?: number | null,"used_count"?: number,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "admin_reply": string,"author_name": string,"body": string,"created_at": string,"id": string,"order_id": string | null,"product_id": string,"rating": number,"status": Database["public"]['Enums']["review_status"],"title": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_reply"?: string,"author_name": string,"body"?: string,"created_at"?: string,"id"?: string,"order_id"?: string | null,"product_id": string,"rating": number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "admin_reply"?: string,"author_name"?: string,"body"?: string,"created_at"?: string,"id"?: string,"order_id"?: string | null,"product_id"?: string,"rating"?: number,"status"?: Database["public"]['Enums']["review_status"],"title"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"shipping_methods": {
                  Row: {
                    "amount": number,"description": string,"id": string,"is_active": boolean,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number,"description"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "amount"?: number,"description"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"product_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"product_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"product_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            admin_product_views: { Args: Record<PropertyKey, never>; Returns: { product_id: string; views: number }[] },

            "admin_customers":
{ Args: { "p_search"?: string }; Returns: {
              "created_at": string,"email": string,"first_name": string,"id": string,"last_name": string,"last_order_at": string,"orders_count": number,"phone": string,"total_spent": number
            }[]
                           },
"admin_dashboard_stats":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_sales_series":
{ Args: { "p_bucket"?: string,"p_from": string,"p_to": string }; Returns: {
              "bucket": string,"orders": number,"revenue": number
            }[]
                           },
"admin_set_order_status":
{ Args: { "p_note"?: string,"p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"admin_top_categories":
{ Args: { "p_from": string,"p_limit"?: number,"p_to": string }; Returns: {
              "category_id": string,"image_url": string,"name": string,"revenue": number,"share": number,"units": number
            }[]
                           },
"admin_top_products":
{ Args: { "p_from": string,"p_limit"?: number,"p_to": string }; Returns: {
              "image_url": string,"name": string,"product_id": string,"revenue": number,"units": number
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"place_order":
{ Args: { "p_address": Json,"p_contact": Json,"p_items": Json,"p_note"?: string,"p_payment_method"?: string,"p_promo_code"?: string,"p_shipping_method_id"?: string }; Returns: Json
                           },
"slugify":
{ Args: { "txt": string }; Returns: string
                           },
"track_order":
{ Args: { "p_email": string,"p_order_number": string }; Returns: Json
                           },
"unaccent":
{ Args: { "": string }; Returns: string
                           },
"validate_promo":
{ Args: { "p_code": string,"p_subtotal": number }; Returns: Json
                           }
          }
          Enums: {
            "order_status": "pending"|"processing"|"shipped"|"delivered"|"cancelled","page_status": "draft"|"published","payment_status": "unpaid"|"awaiting_confirmation"|"paid"|"refunded"|"failed","product_status": "draft"|"published"|"archived","promo_type": "percent"|"fixed","review_status": "pending"|"published"|"rejected","user_role": "customer"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "order_status": ["pending", "processing", "shipped", "delivered", "cancelled"],"page_status": ["draft", "published"],"payment_status": ["unpaid", "awaiting_confirmation", "paid", "refunded", "failed"],"product_status": ["draft", "published", "archived"],"promo_type": ["percent", "fixed"],"review_status": ["pending", "published", "rejected"],"user_role": ["customer", "admin"]
          }
        }
} as const
