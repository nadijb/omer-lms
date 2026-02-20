// POST /api/lms/admin/content/upload-url
// Returns a Supabase signed upload URL so the client can upload directly.
// Flow: client gets { uploadUrl, token, path, publicUrl } → PUTs file to uploadUrl → saves lesson with publicUrl.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/server-auth';

const BUCKET = process.env.SUPABASE_VIDEO_BUCKET || 'lms-videos';

export async function POST(request) {
  const { authError } = await requireRole(request, 'admin', 'training');
  if (authError) return authError;

  const { filename, contentType } = await request.json();
  if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const safeName = `${Date.now()}-${filename.replace(/\s+/g, '_')}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(safeName);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(safeName);

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path: safeName,
    publicUrl: publicData.publicUrl,
  });
}
