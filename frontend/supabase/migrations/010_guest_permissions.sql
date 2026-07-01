-- Guest access: invite external collaborators with limited, scoped permissions

CREATE TABLE IF NOT EXISTS guest_invites (
  id text PRIMARY KEY DEFAULT 'gi' || extract(epoch from now())::text || floor(random()*1000)::text,
  email text NOT NULL,
  org_id text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'guest', -- 'guest' | 'viewer'
  spaces text[] DEFAULT '{}',         -- which space IDs they can access (empty = all)
  token text UNIQUE NOT NULL,         -- secure invite token
  accepted boolean DEFAULT false,
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS space_permissions (
  id text PRIMARY KEY DEFAULT 'sp' || extract(epoch from now())::text || floor(random()*1000)::text,
  space_id text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member' | 'viewer'
  created_at timestamptz DEFAULT now(),
  UNIQUE(space_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_invites_org ON guest_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_guest_invites_email ON guest_invites(email);
CREATE INDEX IF NOT EXISTS idx_guest_invites_token ON guest_invites(token);
CREATE INDEX IF NOT EXISTS idx_space_perms_space ON space_permissions(space_id);
CREATE INDEX IF NOT EXISTS idx_space_perms_user ON space_permissions(user_id);
