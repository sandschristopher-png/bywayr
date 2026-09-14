import { supabase } from './supabase';

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// Fetch all custom categories created by the logged-in user
export async function getUserCustomCategories(): Promise<CustomCategory[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_custom_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Create a new custom category (Plus feature)
export async function createCustomCategory(
  name: string,
  icon: string = 'bookmark',
  color: string = '#2563eb'
): Promise<CustomCategory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('user_custom_categories')
    .insert([
      {
        user_id: user.id,
        name: name.trim(),
        icon,
        color,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a custom category
export async function deleteCustomCategory(categoryId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('user_custom_categories')
    .delete()
    .eq('id', categoryId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// Assign categories to a specific spot
export async function tagSpotWithCategories(spotId: string, categoryIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const rows = categoryIds.map((categoryId) => ({
    user_id: user.id,
    spot_id: spotId,
    category_id: categoryId,
  }));

  const { error } = await supabase
    .from('user_spot_categories')
    .upsert(rows, { onConflict: 'user_id,spot_id,category_id' });

  if (error) throw error;
}

// Get category IDs assigned to a specific spot
export async function getSpotCategoryIds(spotId: string): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_spot_categories')
    .select('category_id')
    .eq('user_id', user.id)
    .eq('spot_id', spotId);

  if (error) throw error;
  return (data || []).map((row) => row.category_id);
}