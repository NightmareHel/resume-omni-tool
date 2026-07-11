import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof) return NextResponse.json({ profile: null });

  return NextResponse.json({
    profile: {
      ...prof,
      experience:       prof.experience       ? JSON.parse(prof.experience)       : null,
      projects:         prof.projects         ? JSON.parse(prof.projects)         : null,
      education:        prof.education        ? JSON.parse(prof.education)        : null,
      skills:           prof.skills           ? JSON.parse(prof.skills)           : null,
      target_roles:     prof.target_roles     ? JSON.parse(prof.target_roles)     : null,
      target_locations: prof.target_locations ? JSON.parse(prof.target_locations) : null,
    },
  });
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const now = new Date().toISOString();

  const values = {
    id:               'default' as const,
    full_name:        body.full_name        ?? null,
    email:            body.email            ?? null,
    phone:            body.phone            ?? null,
    location:         body.location         ?? null,
    linkedin_url:     body.linkedin_url     ?? null,
    github_url:       body.github_url       ?? null,
    portfolio_url:    body.portfolio_url    ?? null,
    summary:          body.summary          ?? null,
    experience:       body.experience       ? JSON.stringify(body.experience)       : null,
    projects:         body.projects         ? JSON.stringify(body.projects)         : null,
    education:        body.education        ? JSON.stringify(body.education)        : null,
    skills:           body.skills           ? JSON.stringify(body.skills)           : null,
    target_roles:     body.target_roles     ? JSON.stringify(body.target_roles)     : null,
    target_locations: body.target_locations ? JSON.stringify(body.target_locations) : null,
    salary_min:       body.salary_min       ?? null,
    updated_at:       now,
  };

  await db.insert(profile).values(values).onConflictDoUpdate({
    target: profile.id,
    set: { ...values, id: undefined },
  });

  const [saved] = await db.select().from(profile).where(eq(profile.id, 'default'));
  return NextResponse.json({
    profile: {
      ...saved,
      experience:       saved.experience       ? JSON.parse(saved.experience)       : null,
      projects:         saved.projects         ? JSON.parse(saved.projects)         : null,
      education:        saved.education        ? JSON.parse(saved.education)        : null,
      skills:           saved.skills           ? JSON.parse(saved.skills)           : null,
      target_roles:     saved.target_roles     ? JSON.parse(saved.target_roles)     : null,
      target_locations: saved.target_locations ? JSON.parse(saved.target_locations) : null,
    },
  });
}
