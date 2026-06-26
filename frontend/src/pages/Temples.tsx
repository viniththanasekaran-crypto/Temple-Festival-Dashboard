import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import {
  getTemples,
  createTemple,
  updateTemple,
  deleteTemple,
  getDistricts,
  type Temple,
  type TempleContact,
  type CreateTemplePayload,
} from '../api/temples'
import { formatPhone, toE164, fromE164 } from '../utils/phone'
import styles from './Temples.module.css'

type ModalMode = 'add' | 'edit' | null

interface ContactRow {
  name: string
  phone: string // 10-digit, no +91
}

interface TempleFormState {
  name: string
  deity: string
  village: string
  address: string
  about: string
  phone: string
  phone2: string
  phone3: string
  contacts: ContactRow[]
  districtId: number
}

const EMPTY_FORM: TempleFormState = {
  name: '',
  deity: '',
  village: '',
  address: '',
  about: '',
  phone: '',
  phone2: '',
  phone3: '',
  contacts: [],
  districtId: 0,
}

function toFormContacts(stored: TempleContact[]): ContactRow[] {
  return stored.map((c) => ({ name: c.name, phone: fromE164(c.phone ?? '') }))
}

function toApiContacts(rows: ContactRow[]): TempleContact[] {
  return rows
    .filter((r) => r.name.trim())
    .map((r) => ({ name: r.name.trim(), ...(r.phone ? { phone: toE164(r.phone) } : {}) }))
}

export default function Temples() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<Temple | null>(null)
  const [form, setForm] = useState<TempleFormState>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Temple | null>(null)
  const [viewTarget, setViewTarget] = useState<Temple | null>(null)

  const { data: temples = [], isLoading } = useQuery({ queryKey: ['temples'], queryFn: getTemples })
  const { data: districts = [] } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const createMutation = useMutation({
    mutationFn: createTemple,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['temples'] }); closeModal() },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to create temple'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateTemplePayload> }) =>
      updateTemple(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['temples'] }); closeModal() },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to update temple'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTemple,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['temples'] }); setDeleteTarget(null) },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      alert(e.response?.data?.message ?? 'Failed to delete temple'),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModal('add')
  }

  function openEdit(temple: Temple) {
    setSelected(temple)
    setForm({
      name: temple.name,
      deity: temple.deity ?? '',
      village: temple.village ?? '',
      address: temple.address ?? '',
      about: temple.about ?? '',
      phone: fromE164(temple.phone ?? ''),
      phone2: fromE164(temple.phone2 ?? ''),
      phone3: fromE164(temple.phone3 ?? ''),
      contacts: toFormContacts(temple.contacts),
      districtId: temple.districtId,
    })
    setFormError('')
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setFormError('')
  }

  function setPhone(key: 'phone' | 'phone2' | 'phone3', raw: string) {
    setForm((f) => ({ ...f, [key]: raw.replace(/\D/g, '').slice(0, 10) }))
  }

  function addContact() {
    setForm((f) => ({ ...f, contacts: [...f.contacts, { name: '', phone: '' }] }))
  }

  function removeContact(i: number) {
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }))
  }

  function updateContact(i: number, field: 'name' | 'phone', value: string) {
    setForm((f) => {
      const contacts = f.contacts.map((c, idx) =>
        idx === i
          ? { ...c, [field]: field === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value }
          : c
      )
      return { ...f, contacts }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.districtId) { setFormError('Please select a district'); return }
    const payload: CreateTemplePayload = {
      name: form.name,
      districtId: form.districtId,
      ...(form.deity && { deity: form.deity }),
      ...(form.village && { village: form.village }),
      ...(form.address && { address: form.address }),
      ...(form.about && { about: form.about }),
      ...(toE164(form.phone) && { phone: toE164(form.phone) }),
      ...(toE164(form.phone2) && { phone2: toE164(form.phone2) }),
      ...(toE164(form.phone3) && { phone3: toE164(form.phone3) }),
      contacts: toApiContacts(form.contacts),
    }
    if (modal === 'add') createMutation.mutate(payload)
    else if (selected) updateMutation.mutate({ id: selected.id, payload })
  }

  const filtered = temples.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.village ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.district.name.toLowerCase().includes(search.toLowerCase())
  )

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h1 className={styles.heading}>Temples</h1>
          <div className={styles.toolbarRight}>
            <input
              className={styles.search}
              placeholder="Search by name, village, district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={styles.addBtn} onClick={openAdd}>
              + Add Temple
            </button>
          </div>
        </div>

        {isLoading && <p className={styles.hint}>Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className={styles.hint}>No temples found. Add one to get started.</p>
        )}

        <div className={styles.grid}>
          {filtered.map((temple) => (
            <div key={temple.id} className={styles.card}>
              <div className={styles.cardCover}>
                <span className={styles.cardInitial}>{temple.name[0]}</span>
              </div>
              <div className={styles.cardBody}>
                <h2 className={styles.cardName}>{temple.name}</h2>
                {temple.deity && <p className={styles.cardDeity}>{temple.deity}</p>}
                <p className={styles.cardMeta}>
                  {[temple.village, temple.district.name].filter(Boolean).join(', ')}
                </p>
                {temple.phone && <p className={styles.cardPhone}>{formatPhone(temple.phone)}</p>}
                <p className={styles.cardStats}>
                  {temple._count.festivals} festivals · {temple._count.families} families
                </p>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.viewBtn} onClick={() => setViewTarget(temple)}>
                  Details
                </button>
                <button className={styles.editBtn} onClick={() => openEdit(temple)}>
                  Edit
                </button>
                <button className={styles.deleteBtn} onClick={() => setDeleteTarget(temple)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Temple' : 'Edit Temple'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label>
              Temple Name *
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Deity
              <input value={form.deity} onChange={(e) => setForm({ ...form, deity: e.target.value })} />
            </label>
            <label>
              Village / Area
              <input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
            </label>
            <label>
              Address
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label>
              About
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
                placeholder="Brief description of the temple…"
              />
            </label>

            <div className={styles.sectionLabel}>Contact Numbers</div>
            <label>
              Primary Phone
              <PhoneInput value={form.phone} onChange={(v) => setPhone('phone', v)} />
            </label>
            <label>
              Phone 2
              <PhoneInput value={form.phone2} onChange={(v) => setPhone('phone2', v)} />
            </label>
            <label>
              Phone 3
              <PhoneInput value={form.phone3} onChange={(v) => setPhone('phone3', v)} />
            </label>

            <div className={styles.sectionLabel}>
              Temple Contacts
              <button type="button" className={styles.addContactBtn} onClick={addContact}>
                + Add
              </button>
            </div>
            {form.contacts.map((c, i) => (
              <div key={i} className={styles.contactRow}>
                <input
                  className={styles.contactName}
                  placeholder="Name"
                  value={c.name}
                  onChange={(e) => updateContact(i, 'name', e.target.value)}
                />
                <div className={styles.phoneRow}>
                  <span className={styles.phonePrefix}>+91</span>
                  <input
                    className={styles.phoneInput}
                    placeholder="Phone"
                    value={c.phone}
                    maxLength={10}
                    inputMode="numeric"
                    onChange={(e) => updateContact(i, 'phone', e.target.value)}
                  />
                </div>
                <button type="button" className={styles.removeBtn} onClick={() => removeContact(i)}>
                  ✕
                </button>
              </div>
            ))}
            {form.contacts.length === 0 && (
              <p className={styles.emptyContacts}>No contacts added yet.</p>
            )}

            <label>
              District *
              <select
                required
                value={form.districtId || ''}
                onChange={(e) => setForm({ ...form, districtId: Number(e.target.value) })}
              >
                <option value="">Select district…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>

            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? 'Saving…' : modal === 'add' ? 'Add Temple' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── View Details Modal ───────────────────────────────────── */}
      {viewTarget && (
        <Modal title={viewTarget.name} onClose={() => setViewTarget(null)}>
          <div className={styles.detail}>
            {viewTarget.deity && <p className={styles.detailDeity}>{viewTarget.deity}</p>}

            <dl className={styles.detailGrid}>
              {viewTarget.village && (
                <>
                  <dt>Village / Area</dt>
                  <dd>{viewTarget.village}</dd>
                </>
              )}
              <dt>District</dt>
              <dd>{viewTarget.district.name}</dd>
              {viewTarget.address && (
                <>
                  <dt>Address</dt>
                  <dd>{viewTarget.address}</dd>
                </>
              )}
              <dt>Festivals</dt>
              <dd>{viewTarget._count.festivals}</dd>
              <dt>Families</dt>
              <dd>{viewTarget._count.families}</dd>
            </dl>

            {viewTarget.about && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>About</div>
                <p className={styles.detailAbout}>{viewTarget.about}</p>
              </div>
            )}

            {(viewTarget.phone || viewTarget.phone2 || viewTarget.phone3) && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Contact Numbers</div>
                <div className={styles.detailPhones}>
                  {viewTarget.phone && <span>{formatPhone(viewTarget.phone)}</span>}
                  {viewTarget.phone2 && <span>{formatPhone(viewTarget.phone2)}</span>}
                  {viewTarget.phone3 && <span>{formatPhone(viewTarget.phone3)}</span>}
                </div>
              </div>
            )}

            {viewTarget.contacts.length > 0 && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Temple Contacts</div>
                <ul className={styles.detailContacts}>
                  {viewTarget.contacts.map((c, i) => (
                    <li key={i}>
                      <span className={styles.contactPersonName}>{c.name}</span>
                      {c.phone && <span className={styles.contactPersonPhone}>{formatPhone(c.phone)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.formActions}>
              <button className={styles.editBtn} onClick={() => { setViewTarget(null); openEdit(viewTarget) }}>
                Edit Temple
              </button>
              <button className={styles.cancelBtn} onClick={() => setViewTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────── */}
      {deleteTarget && (
        <Modal title="Delete Temple" onClose={() => setDeleteTarget(null)}>
          <p>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
          {(deleteTarget._count.festivals > 0 || deleteTarget._count.families > 0) && (
            <p className={styles.error}>
              Cannot delete — this temple has {deleteTarget._count.festivals} festival(s) and{' '}
              {deleteTarget._count.families} family record(s).
            </p>
          )}
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button
              className={styles.deleteBtn}
              disabled={deleteMutation.isPending || deleteTarget._count.festivals > 0 || deleteTarget._count.families > 0}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className={styles.phoneRow}>
      <span className={styles.phonePrefix}>+91</span>
      <input
        className={styles.phoneInput}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="98765 43210"
        maxLength={10}
        inputMode="numeric"
      />
    </div>
  )
}
