-- Storage setup for persistent thumbnails
-- Run this in Supabase SQL Editor to create the thumbnails bucket

-- Create the thumbnails bucket (if using SQL)
-- Note: You may need to create this via the Supabase Dashboard instead:
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name it "thumbnails"
-- 4. Make sure "Public bucket" is checked (so images can be accessed without auth)

-- If your Supabase version supports it, you can use:
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in the thumbnails bucket
CREATE POLICY "Public read access for thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');

-- Allow authenticated users to upload (using service role key bypasses this anyway)
CREATE POLICY "Service role upload access for thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'thumbnails');

-- Allow service role to update/overwrite files
CREATE POLICY "Service role update access for thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'thumbnails');

-- Allow service role to delete files
CREATE POLICY "Service role delete access for thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'thumbnails');

