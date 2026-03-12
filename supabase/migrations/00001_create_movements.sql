CREATE TABLE movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  intensity TEXT NOT NULL CHECK (intensity IN ('mycket', 'mellan', 'lite')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_user_occurred ON movements (user_id, occurred_at);

ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- Users can only read their own movements
CREATE POLICY "Users can select own movements"
ON movements FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only insert their own movements
CREATE POLICY "Users can insert own movements"
ON movements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own movements (needed for undo)
CREATE POLICY "Users can delete own movements"
ON movements FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
