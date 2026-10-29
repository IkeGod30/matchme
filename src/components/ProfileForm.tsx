import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  GENDERS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  SELF_FEATURES,
  featureGenders,
  figureFor,
  formatHeight,
  genderNoun,
  heightBand,
  preferenceFeaturesFor,
  selfFeaturesFor,
  wantedOptions,
} from '../data/attributes'
import { COUNTRIES, PROFESSIONS, RACES } from '../data/options'
import { SAMPLE_PROFILES } from '../data/sampleProfiles'
import { resizeImage } from '../lib/format'
import type { PartnerRequest, PhysicalProfile, Profile } from '../types'
import { ChipSelect } from './ChipSelect'
import { FeatureArt } from './FeatureArt'
import { FeaturePicker } from './FeaturePicker'
import { Portrait } from './Portrait'
import { RequestSummary } from './RequestSummary'
import { TagInput } from './TagInput'
import { VisibilitySetting } from './VisibilitySetting'

const STEPS = ['About you', 'Your body', 'Your request', 'Desired features', 'Review'] as const
const WIZARD_STEP = 3
const MIN_MESSAGE_LENGTH = 20

const LOCATION_SUGGESTIONS = [...new Set([...COUNTRIES, ...SAMPLE_PROFILES.map((p) => p.city)])].sort()

interface ProfileFormProps {
  initial: Profile
  isNew: boolean
  onSave: (profile: Profile) => void
  onCancel?: () => void
}

function validate(step: number, p: Profile): string[] {
  const errors: string[] = []
  if (step === 0) {
    if (!p.name.trim()) errors.push('Enter your name.')
    if (!Number.isFinite(p.age) || p.age < 18 || p.age > 99) errors.push('Age must be between 18 and 99.')
    if (!p.city.trim() || !p.country) errors.push('Enter your city and country.')
    if (!p.nationality) errors.push('Choose your nationality.')
    if (!p.race) errors.push('Choose your race / ethnicity.')
    if (!p.profession) errors.push('Choose your profession.')
  }
  if (step === 1) {
    const missing = selfFeaturesFor(p.gender)
      .filter((f) => !p.physical[f.key])
      .map((f) => f.label.toLowerCase())
    if (missing.length) errors.push(`Pick a picture for your ${missing.join(', ')}.`)
  }
  if (step === 2) {
    const r = p.request
    if (r.message.trim().length < MIN_MESSAGE_LENGTH) {
      errors.push(`Describe the person you're looking for (at least ${MIN_MESSAGE_LENGTH} characters).`)
    }
    if (r.seeking.length === 0) errors.push('Choose who you are interested in.')
    if (r.ageMin < 18 || r.ageMax > 99 || r.ageMin > r.ageMax) errors.push('Partner age range is invalid.')
  }
  return errors
}

export function ProfileForm({ initial, isNew, onSave, onCancel }: ProfileFormProps) {
  const [draft, setDraft] = useState<Profile>(initial)
  const [step, setStep] = useState(0)
  const [featureIdx, setFeatureIdx] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const selfFeatures = selfFeaturesFor(draft.gender)
  const wizardFeatures = preferenceFeaturesFor(draft.request.seeking)
  // The seeking list can change after visiting the wizard, so keep the index in range.
  const wizardIdx = Math.min(featureIdx, wizardFeatures.length - 1)

  const update = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }))
  const updatePhysical = (patch: Partial<PhysicalProfile>) =>
    setDraft((d) => ({ ...d, physical: { ...d.physical, ...patch } }))
  const updateRequest = (patch: Partial<PartnerRequest>) =>
    setDraft((d) => ({ ...d, request: { ...d.request, ...patch } }))

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      update({ photo: await resizeImage(file) })
    } catch (error) {
      setErrors([(error as Error).message])
    }
  }

  function goTo(nextStep: number) {
    setErrors([])
    setStep(nextStep)
    window.scrollTo({ top: 0 })
  }

  function next(event: FormEvent) {
    event.preventDefault()
    const found = validate(step, draft)
    setErrors(found)
    if (found.length) return
    if (step === WIZARD_STEP && wizardIdx < wizardFeatures.length - 1) {
      setFeatureIdx(wizardIdx + 1)
      return
    }
    if (step < STEPS.length - 1) {
      goTo(step + 1)
      return
    }
    // Drop answers for features that no longer apply (e.g. after changing gender or who you seek).
    const ownKeys = new Set<string>(selfFeatures.map((f) => f.key))
    const wantedKeys = new Set<string>(wizardFeatures.map((f) => f.key))
    onSave({
      ...draft,
      name: draft.name.trim(),
      city: draft.city.trim(),
      jobTitle: draft.jobTitle.trim(),
      bio: draft.bio.trim(),
      physical: {
        ...draft.physical,
        ...Object.fromEntries(SELF_FEATURES.map((f) => [f.key, ownKeys.has(f.key) ? (draft.physical[f.key] ?? '') : ''])),
      },
      request: {
        ...draft.request,
        message: draft.request.message.trim(),
        physical: Object.fromEntries(
          Object.keys(draft.request.physical).map((key) => [
            key,
            wantedKeys.has(key) ? draft.request.physical[key as keyof typeof draft.request.physical] : [],
          ]),
        ) as typeof draft.request.physical,
      },
    })
  }

  function back() {
    if (step === WIZARD_STEP && wizardIdx > 0) {
      setErrors([])
      setFeatureIdx(wizardIdx - 1)
      return
    }
    goTo(step - 1)
  }

  // Steps before the current one are always reachable; when editing, any step is.
  const canJumpTo = (i: number) => i < step || (!isNew && i !== step)
  const feature = wizardFeatures[wizardIdx]
  const featureFor = featureGenders(feature)

  return (
    <form className="card form" onSubmit={next} noValidate>
      <ol className="stepper">
        {STEPS.map((label, i) => (
          <li key={label} data-state={i === step ? 'current' : i < step ? 'done' : 'todo'}>
            <button type="button" disabled={!canJumpTo(i)} onClick={() => goTo(i)}>
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="form-section">
          <h2>About you</h2>
          <div className="photo-field">
            <Portrait profile={draft} size={96} />
            <div>
              <div className="photo-actions">
                <label className="btn ghost">
                  {draft.photo ? 'Change photo' : 'Upload a photo'}
                  <input type="file" accept="image/*" hidden onChange={onPhoto} />
                </label>
                {draft.photo && (
                  <button type="button" className="link-btn" onClick={() => update({ photo: undefined })}>
                    Remove
                  </button>
                )}
              </div>
              <p className="hint small">
                Your matchmaker shows this to seekers you're proposed to. Without a photo, an illustration based on
                your features is used.
              </p>
            </div>
          </div>
          <div className="grid-2">
            <label className="field">
              <span>Name</span>
              <input value={draft.name} onChange={(e) => update({ name: e.target.value })} autoFocus />
            </label>
            <label className="field">
              <span>Age</span>
              <input
                type="number"
                min={18}
                max={99}
                value={Number.isNaN(draft.age) ? '' : draft.age}
                onChange={(e) => update({ age: e.target.valueAsNumber })}
              />
            </label>
          </div>
          <ChipSelect
            label="I am a"
            options={GENDERS.map((g) => g.label)}
            selected={GENDERS.filter((g) => g.value === draft.gender).map((g) => g.label)}
            onChange={([label]) => update({ gender: GENDERS.find((g) => g.label === label)!.value })}
          />
          <div className="grid-2">
            <label className="field">
              <span>City</span>
              <input value={draft.city} onChange={(e) => update({ city: e.target.value })} />
            </label>
            <label className="field">
              <span>Country of residence</span>
              <select value={draft.country} onChange={(e) => update({ country: e.target.value })}>
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Nationality</span>
              <select value={draft.nationality} onChange={(e) => update({ nationality: e.target.value })}>
                <option value="">Select…</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Race / ethnicity</span>
              <select value={draft.race} onChange={(e) => update({ race: e.target.value })}>
                <option value="">Select…</option>
                {RACES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Profession</span>
              <select value={draft.profession} onChange={(e) => update({ profession: e.target.value })}>
                <option value="">Select…</option>
                {PROFESSIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Job title (optional)</span>
              <input value={draft.jobTitle} onChange={(e) => update({ jobTitle: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>About me (optional)</span>
            <textarea rows={3} value={draft.bio} onChange={(e) => update({ bio: e.target.value })} />
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="form-section">
          <h2>Your body</h2>
          <p className="muted">
            Pick the picture closest to you for each feature. Matches see this to judge how well you fit their
            request.
          </p>
          <label className="field height-field">
            <FeatureArt
              feature="height"
              option={heightBand(draft.physical.heightCm)}
              size={72}
              figure={figureFor([draft.gender])}
            />
            <span>
              Height <strong>{formatHeight(draft.physical.heightCm)}</strong>
              <input
                type="range"
                min={HEIGHT_MIN_CM}
                max={HEIGHT_MAX_CM}
                value={draft.physical.heightCm}
                onChange={(e) => updatePhysical({ heightCm: e.target.valueAsNumber })}
              />
            </span>
          </label>
          {selfFeatures.map((f) => (
            <FeaturePicker
              key={f.key}
              label={f.label}
              feature={f}
              figure={figureFor([draft.gender])}
              selected={draft.physical[f.key] ? [draft.physical[f.key]] : []}
              onChange={([value]) => updatePhysical({ [f.key]: value })}
            />
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="form-section">
          <h2>Your request</h2>
          <label className="field">
            <span>Describe the person you'd like to meet</span>
            <textarea
              rows={5}
              value={draft.request.message}
              placeholder="e.g. A kind, family-oriented man in his thirties who loves to travel, has a good sense of humour and is settled in his career…"
              onChange={(e) => updateRequest({ message: e.target.value })}
            />
            <span className="hint small">{draft.request.message.trim().length} characters</span>
          </label>
          <ChipSelect
            label="Interested in"
            multiple
            options={GENDERS.map((g) => g.label)}
            selected={GENDERS.filter((g) => draft.request.seeking.includes(g.value)).map((g) => g.label)}
            onChange={(labels) =>
              updateRequest({ seeking: GENDERS.filter((g) => labels.includes(g.label)).map((g) => g.value) })
            }
          />
          <div className="grid-2">
            <label className="field">
              <span>Partner age from</span>
              <input
                type="number"
                min={18}
                max={99}
                value={draft.request.ageMin}
                onChange={(e) => updateRequest({ ageMin: e.target.valueAsNumber })}
              />
            </label>
            <label className="field">
              <span>to</span>
              <input
                type="number"
                min={18}
                max={99}
                value={draft.request.ageMax}
                onChange={(e) => updateRequest({ ageMax: e.target.valueAsNumber })}
              />
            </label>
          </div>
          <TagInput
            label="Preferred location of partner"
            hint="cities or countries · leave empty for anywhere"
            placeholder="Type a city or country and press Enter"
            values={draft.request.locations}
            suggestions={LOCATION_SUGGESTIONS}
            onChange={(locations) => updateRequest({ locations })}
          />
          <ChipSelect
            label="Race / ethnicity"
            hint={draft.request.races.length ? `${draft.request.races.length} selected` : 'open to all'}
            multiple
            options={RACES}
            selected={draft.request.races}
            onChange={(races) => updateRequest({ races })}
          />
          <TagInput
            label="Nationality"
            hint="leave empty for any"
            placeholder="Type a nationality (country) and press Enter"
            values={draft.request.nationalities}
            suggestions={COUNTRIES}
            onChange={(nationalities) => updateRequest({ nationalities })}
          />
          <ChipSelect
            label="Profession"
            hint={draft.request.professions.length ? `${draft.request.professions.length} selected` : 'open to all'}
            multiple
            options={PROFESSIONS}
            selected={draft.request.professions}
            onChange={(professions) => updateRequest({ professions })}
          />
        </section>
      )}

      {step === WIZARD_STEP && (
        <section className="form-section wizard">
          <div className="wizard-head">
            <span className="muted small">
              Feature {wizardIdx + 1} of {wizardFeatures.length}
            </span>
            <div className="wizard-dots">
              {wizardFeatures.map((f, i) => (
                <button
                  key={f.key}
                  type="button"
                  aria-label={f.label}
                  aria-current={i === wizardIdx}
                  data-set={wantedOptions(draft.request.physical, f.key).length > 0 || undefined}
                  onClick={() => setFeatureIdx(i)}
                />
              ))}
            </div>
          </div>
          <h2>{feature.question}</h2>
          {featureFor && <span className="badge applies">In {genderNoun(featureFor)}</span>}
          <p className="muted">
            Tap every example you'd be happy with, or choose <em>No preference</em>.
          </p>
          <FeaturePicker
            key={feature.key}
            feature={feature}
            figure={figureFor(draft.request.seeking)}
            multiple
            selected={wantedOptions(draft.request.physical, feature.key)}
            onChange={(values) =>
              updateRequest({ physical: { ...draft.request.physical, [feature.key]: values } })
            }
          />
        </section>
      )}

      {step === 4 && (
        <section className="form-section">
          <h2>Review your request</h2>
          <p className="muted">
            Your matchmaker will use this to hand-pick partners for you, then send you their pictures to accept or
            decline. Use the steps above to change anything.
          </p>
          <RequestSummary request={draft.request} />
          <VisibilitySetting isPublic={!!draft.publicListing} onChange={(publicListing) => update({ publicListing })} />
        </section>
      )}

      {errors.length > 0 && (
        <ul className="errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="form-actions">
        {step > 0 ? (
          <button type="button" className="btn ghost" onClick={back}>
            Back
          </button>
        ) : (
          onCancel && (
            <button type="button" className="btn ghost" onClick={onCancel}>
              Cancel
            </button>
          )
        )}
        <button type="submit" className="btn primary">
          {step < STEPS.length - 1 ? 'Continue' : isNew ? 'Send request to matchmaker' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
