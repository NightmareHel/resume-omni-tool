'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/lib/toast';

interface ExperienceEntry { company: string; title: string; start: string; end: string; bullets: string[] }
interface ProjectEntry    { name: string; tech: string; link: string; bullets: string[] }
interface EducationEntry  { school: string; degree: string; end: string; gpa?: string; details?: string }

interface ProfileData {
  full_name:        string;
  email:            string;
  phone:            string;
  location:         string;
  linkedin_url:     string;
  github_url:       string;
  portfolio_url:    string;
  summary:          string;
  skills:           string[];
  experience:       ExperienceEntry[];
  projects:         ProjectEntry[];
  education:        EducationEntry[];
  target_roles:     string[];
  target_locations: string[];
  salary_min:       string;
}

const empty: ProfileData = {
  full_name: '', email: '', phone: '', location: '', linkedin_url: '', github_url: '', portfolio_url: '',
  summary: '', skills: [], experience: [], projects: [], education: [], target_roles: [], target_locations: [], salary_min: '',
};

interface Props {
  initial?: Partial<ProfileData> | null;
  onSaved?: () => void;
}

function TagInput({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {tags.map((t) => (
          <span key={t} className="bg-zinc-700 text-zinc-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-zinc-400 hover:text-red-400 text-xs leading-none">&times;</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1 text-sm placeholder-zinc-500"
          value={input}
          placeholder={`Add ${label.toLowerCase()}...`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button onClick={add} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-3 py-1 rounded">Add</button>
      </div>
    </div>
  );
}

export default function ProfileEditor({ initial, onSaved }: Props) {
  const { addToast } = useToast();
  const [data, setData] = useState<ProfileData>(() => {
    const base = { ...empty, ...(initial ?? {}) };
    return {
      ...base,
      salary_min: base.salary_min != null ? String(base.salary_min) : '',
      experience: (base.experience ?? []).map((e: ExperienceEntry) => ({
        ...e,
        title:   e.title   ?? '',
        company: e.company ?? '',
        start:   e.start   ?? '',
        end:     e.end     ?? '',
        bullets: e.bullets ?? [],
      })),
      projects: (base.projects ?? []).map((pr: ProjectEntry) => ({
        ...pr,
        name:    pr.name    ?? '',
        tech:    pr.tech    ?? '',
        link:    pr.link    ?? '',
        bullets: pr.bullets ?? [],
      })),
      education: (base.education ?? []).map((e: EducationEntry) => ({
        ...e,
        school: e.school ?? '',
        degree: e.degree ?? '',
        end:    e.end    ?? '',
      })),
    };
  });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const set = (k: keyof ProfileData, v: unknown) => {
    setData((d) => ({ ...d, [k]: v }));
    setIsDirty(true);
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const addExperience = () => set('experience', [...data.experience, { company: '', title: '', start: '', end: '', bullets: [] }]);
  const updateExp = (i: number, field: keyof ExperienceEntry, val: string | string[]) => {
    const exp = [...data.experience];
    exp[i] = { ...exp[i], [field]: val };
    set('experience', exp);
  };
  const removeExp = (i: number) => set('experience', data.experience.filter((_, idx) => idx !== i));

  const addProject = () => set('projects', [...data.projects, { name: '', tech: '', link: '', bullets: [] }]);
  const updateProj = (i: number, field: keyof ProjectEntry, val: string | string[]) => {
    const projects = [...data.projects];
    projects[i] = { ...projects[i], [field]: val };
    set('projects', projects);
  };
  const removeProject = (i: number) => set('projects', data.projects.filter((_, idx) => idx !== i));

  const addEducation = () => set('education', [...data.education, { school: '', degree: '', end: '' }]);
  const updateEdu = (i: number, field: keyof EducationEntry, val: string) => {
    const edu = [...data.education];
    edu[i] = { ...edu[i], [field]: val };
    set('education', edu);
  };
  const removeEdu = (i: number) => set('education', data.education.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, salary_min: data.salary_min ? parseFloat(data.salary_min) : null }),
    });
    setSaving(false);
    if (res.ok) {
      setIsDirty(false);
      addToast('Profile saved', 'success');
      onSaved?.();
    } else {
      addToast('Failed to save profile', 'error');
    }
  };

  const field = (label: string, key: keyof ProfileData, placeholder?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</label>
      <input
        className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm placeholder-zinc-500"
        value={String(data[key] ?? '')}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <section className="flex flex-col gap-4">
        <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2">Contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('Full Name', 'full_name', 'Sid Kumar')}
          {field('Email', 'email', 'sid@example.com')}
          {field('Phone', 'phone', '+1 (555) ...')}
          {field('Location', 'location', 'Philadelphia, PA')}
          {field('LinkedIn URL', 'linkedin_url')}
          {field('GitHub URL', 'github_url')}
          {field('Portfolio URL', 'portfolio_url')}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2">Summary</h2>
        <textarea
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm placeholder-zinc-500 min-h-24 resize-y"
          value={data.summary}
          placeholder="Professional summary..."
          onChange={(e) => set('summary', e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2 flex-1">Experience</h2>
          <button onClick={addExperience} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded ml-4">+ Add</button>
        </div>
        {data.experience.map((e, i) => (
          <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Job title" value={e.title ?? ''} onChange={(ev) => updateExp(i, 'title', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Company" value={e.company ?? ''} onChange={(ev) => updateExp(i, 'company', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Start (YYYY-MM)" value={e.start ?? ''} onChange={(ev) => updateExp(i, 'start', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="End (YYYY-MM or leave blank)" value={e.end ?? ''} onChange={(ev) => updateExp(i, 'end', ev.target.value)} />
            </div>
            <textarea
              className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm min-h-20 resize-y placeholder-zinc-500"
              placeholder="Bullet points (one per line)"
              value={e.bullets.join('\n')}
              onChange={(ev) => updateExp(i, 'bullets', ev.target.value.split('\n'))}
            />
            <button onClick={() => removeExp(i)} className="self-end text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2 flex-1">Projects</h2>
          <button onClick={addProject} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded ml-4">+ Add</button>
        </div>
        {data.projects.map((pr, i) => (
          <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Project name" value={pr.name ?? ''} onChange={(ev) => updateProj(i, 'name', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Tech (comma-separated)" value={pr.tech ?? ''} onChange={(ev) => updateProj(i, 'tech', ev.target.value)} />
            </div>
            <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Link (github / devpost)" value={pr.link ?? ''} onChange={(ev) => updateProj(i, 'link', ev.target.value)} />
            <textarea
              className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm min-h-20 resize-y placeholder-zinc-500"
              placeholder="Bullet points (one per line)"
              value={pr.bullets.join('\n')}
              onChange={(ev) => updateProj(i, 'bullets', ev.target.value.split('\n'))}
            />
            <button onClick={() => removeProject(i)} className="self-end text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2 flex-1">Education</h2>
          <button onClick={addEducation} className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded ml-4">+ Add</button>
        </div>
        {data.education.map((e, i) => (
          <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="School" value={e.school ?? ''} onChange={(ev) => updateEdu(i, 'school', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="Degree" value={e.degree ?? ''} onChange={(ev) => updateEdu(i, 'degree', ev.target.value)} />
              <input className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-sm" placeholder="End (YYYY-MM)" value={e.end ?? ''} onChange={(ev) => updateEdu(i, 'end', ev.target.value)} />
            </div>
            <button onClick={() => removeEdu(i)} className="self-end text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-zinc-100 font-semibold text-base border-b border-zinc-700 pb-2">Skills & Targets</h2>
        <TagInput label="Skills" tags={data.skills} onChange={(t) => set('skills', t)} />
        <TagInput label="Target Roles" tags={data.target_roles} onChange={(t) => set('target_roles', t)} />
        <TagInput label="Target Locations" tags={data.target_locations} onChange={(t) => set('target_locations', t)} />
        {field('Minimum Salary (USD/year)', 'salary_min', '90000')}
      </section>

      <div className="flex items-center gap-4 border-t border-zinc-700 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
        {isDirty && !saving && (
          <span className="text-amber-400 text-xs">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
