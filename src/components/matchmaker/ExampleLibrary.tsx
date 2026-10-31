import { useState, type ChangeEvent } from 'react'
import { BODY_FEATURES, featureGenders, genderNoun, type FeatureKey } from '../../data/attributes'
import { resizeImage } from '../../lib/format'
import { actions, exampleKey, type AppData } from '../../lib/store'
import { FeatureImage } from '../shared/FeatureImage'

const TOTAL_OPTIONS = BODY_FEATURES.reduce((sum, f) => sum + f.options.length, 0)

/** Matchmaker tool for replacing the built-in illustrations with real-life example photos. */
export function ExampleLibrary({ data }: { data: AppData }) {
  const [error, setError] = useState<string | null>(null)
  const used = Object.keys(data.examples).length

  async function upload(feature: FeatureKey, option: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    try {
      // Errors from the server are shown by the action itself.
      await actions.setExample(feature, option, await resizeImage(file, 320))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="stack">
      <article className="card stack">
        <div className="toolbar">
          <div>
            <h2>Feature example photos</h2>
            <p className="muted">
              Seekers choose bodily features by tapping example pictures. Upload a real-life photo for any option to
              replace the built-in illustration everywhere it appears.
            </p>
          </div>
          <span className="status-chip">
            {used} of {TOTAL_OPTIONS} using photos
          </span>
        </div>
        <div className="guidelines">
          <strong>Photo guidelines</strong>
          <ul>
            <li>Only use photos you have the rights to — licensed stock images or models who consented to this use.</li>
            <li>Adults only, clothed (fitted clothing or swimwear is fine for body shape). No nudity.</li>
            <li>Crop to the feature and keep faces out where possible, so no one is identifiable.</li>
            <li>Square images work best; photos are resized to 320 px.</li>
          </ul>
        </div>
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
      </article>

      {BODY_FEATURES.map((feature) => {
        const genders = featureGenders(feature)
        return (
          <article key={feature.key} className="card">
            <h3>
              {feature.label} {genders && <span className="badge applies">{genderNoun(genders)}</span>}
            </h3>
            <div className="pic-grid example-grid">
              {feature.options.map((option) => {
                const hasPhoto = !!data.examples[exampleKey(feature.key, option)]
                return (
                  <div key={option} className="example-slot">
                    <FeatureImage feature={feature.key} option={option} />
                    <span className="pic-label">{option}</span>
                    <span className="pic-note">{hasPhoto ? 'Photo' : 'Illustration'}</span>
                    <label className="btn ghost small-btn">
                      {hasPhoto ? 'Replace' : 'Upload photo'}
                      <input type="file" accept="image/*" hidden onChange={(e) => upload(feature.key, option, e)} />
                    </label>
                    {hasPhoto && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => actions.setExample(feature.key, option, null)}
                      >
                        Use illustration
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        )
      })}
    </section>
  )
}
