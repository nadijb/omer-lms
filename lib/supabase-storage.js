import { createClient } from '@supabase/supabase-js';

let _supabase = null;
const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
}

export async function uploadToSupabase(file) {
  const supabase = getSupabase();
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteVideoFile(video_url) {
  if (!video_url) return;
  if (video_url.startsWith('/uploads/')) return; // old local path
  try {
    const supabase = getSupabase();
    const filename = video_url.split('/').pop();
    await supabase.storage.from(BUCKET).remove([filename]);
  } catch {}
}
