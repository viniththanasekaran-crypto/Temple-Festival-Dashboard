import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import {
  getFestivals,
  getFestival,
  createFestival,
  updateFestival,
  deleteFestival,
  type Festival,
  type FestivalDetail,
  type CreateFestivalPayload,
} from '../api/festivals'
import { formatPhone, toE164, fromE164 } from '../utils/phone'
import styles from './Festivals.module.css'

type ModalMode = 'add' | 'edit' | null

interface FormState {
  name: string
  description: string
  headName: string
  headPhone: string // 10-digit
  phone2: string
  phone3: string
  startDate: string // YYYY-MM-DD
  endDate: string
  fixedAmount: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  headName: '',
  headPhone: '',
  phone2: '',
  phone3: '',
  startDate: '',
  endDate: '',
  fixedAmount: '',
  isActive: true,
}

function toIso(date: string) {
  return date ? new Date(date).toISOString() : ''
}

function toDateInput(iso: string) {
  return iso ? iso.slice(0, 10) : ''
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

function statusLabel(f: Festival) {
  if (!f.isActive) return { text: 'Inactive', cls: styles.badgeInactive }
  const now = new Date()
  const start = new Date(f.startDate)
  const end = new Date(f.endDate)
  if (now < start) return { text: 'Upcoming', cls: styles.badgeUpcoming }
  if (now > end) return { text: 'Past', cls: styles.badgePast }
  return { text: 'Active', cls: styles.badgeActive }
}

function PhoneInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className={styles.phoneRow}>
      <span className={styles.phonePrefix}>+91</span>
      <input
        className={styles.phoneInput}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder={placeholder ?? '98765 43210'}
        maxLength={10}
        inputMode="numeric"
      />
    </div>
  )
}

export default function Festivals() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<Festival | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Festival | null>(null)
  const [viewId, setViewId] = useState<number | null>(null)

  const { data: festivals = [], isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: getFestivals,
  })

  const { data: detail } = useQuery({
    queryKey: ['festival', viewId],
    queryFn: () => getFestival(viewId!),
    enabled: viewId !== null,
  })

  const createMutation = useMutation({
    mutationFn: createFestival,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['festivals'] }); closeModal() },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to create festival'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateFestivalPayload> }) =>
      updateFestival(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['festivals'] }); closeModal() },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to update festival'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteFestival,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['festivals'] }); setDeleteTarget(null) },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      alert(e.response?.data?.message ?? 'Failed to delete festival'),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModal('add')
  }

  function openEdit(f: Festival) {
    setSelected(f)
    setForm({
      name: f.name,
      description: f.description ?? '',
      headName: f.headName ?? '',
      headPhone: fromE164(f.headPhone ?? ''),
      phone2: fromE164(f.phone2 ?? ''),
      phone3: fromE164(f.phone3 ?? ''),
      startDate: toDateInput(f.startDate),
      endDate: toDateInput(f.endDate),
      fixedAmount: f.fixedAmount,
      isActive: f.isActive,
    })
    setFormError('')
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setFormError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.startDate || !form.endDate) {
      setFormError('Start and end dates are required')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormError('End date must be on or after start date')
      return
    }
    const payload: CreateFestivalPayload = {
      name: form.name,
      startDate: toIso(form.startDate),
      endDate: toIso(form.endDate),
      fixedAmount: Number(form.fixedAmount),
      isActive: form.isActive,
      ...(form.description && { description: form.description }),
      ...(form.headName && { headName: form.headName }),
      ...(toE164(form.headPhone) && { headPhone: toE164(form.headPhone) }),
      ...(toE164(form.phone2) && { phone2: toE164(form.phone2) }),
      ...(toE164(form.phone3) && { phone3: toE164(form.phone3) }),
    }
    if (modal === 'add') createMutation.mutate(payload)
    else if (selected) updateMutation.mutate({ id: selected.id, payload })
  }

  const filtered = festivals.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.headName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h1 className={styles.heading}>Festivals</h1>
          <div className={styles.toolbarRight}>
            <input
              className={styles.search}
              placeholder="Search by name or head…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={styles.addBtn} onClick={openAdd}>
              + Add Festival
            </button>
          </div>
        </div>

        {isLoading && <p className={styles.hint}>Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className={styles.hint}>No festivals found. Add one to get started.</p>
        )}

        <div className={styles.grid}>
          {filtered.map((f) => {
            const status = statusLabel(f)
            return (
              <div key={f.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={`${styles.badge} ${status.cls}`}>{status.text}</span>
                  {!f.isActive && <span className={styles.inactiveTag}>Inactive</span>}
                </div>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardName}>{f.name}</h2>
                  {f.headName && <p className={styles.cardHead}>{f.headName}</p>}
                  <p className={styles.cardDates}>{formatDateRange(f.startDate, f.endDate)}</p>
                  <p className={styles.cardAmount}>
                    ₹{Number(f.fixedAmount).toLocaleString('en-IN')} / family
                  </p>
                  <p className={styles.cardPayments}>{f._count.payments} payment(s) recorded</p>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.viewBtn} onClick={() => setViewId(f.id)}>
                    Details
                  </button>
                  <button className={styles.editBtn} onClick={() => openEdit(f)}>
                    Edit
                  </button>
                  <button className={styles.deleteBtn} onClick={() => setDeleteTarget(f)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ── Add / Edit Modal ────────────────────────────────────── */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Festival' : 'Edit Festival'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label>
              Festival Name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the festival…"
              />
            </label>

            <div className={styles.sectionLabel}>Festival Head</div>
            <label>
              Head Name
              <input
                value={form.headName}
                onChange={(e) => setForm({ ...form, headName: e.target.value })}
                placeholder="Organiser / trustee name"
              />
            </label>
            <label>
              Head Phone
              <PhoneInput value={form.headPhone} onChange={(v) => setForm({ ...form, headPhone: v })} />
            </label>
            <label>
              Phone 2
              <PhoneInput value={form.phone2} onChange={(v) => setForm({ ...form, phone2: v })} />
            </label>
            <label>
              Phone 3
              <PhoneInput value={form.phone3} onChange={(v) => setForm({ ...form, phone3: v })} />
            </label>

            <div className={styles.sectionLabel}>Schedule &amp; Amount</div>
            <div className={styles.dateRow}>
              <label>
                Start Date *
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </label>
              <label>
                End Date *
                <input
                  type="date"
                  required
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </label>
            </div>
            <label>
              Fixed Amount per Family (₹) *
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={form.fixedAmount}
                onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })}
                placeholder="500"
              />
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active festival
            </label>

            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? 'Saving…' : modal === 'add' ? 'Add Festival' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────── */}
      {viewId !== null && (
        <Modal
          title={detail?.name ?? '…'}
          onClose={() => { setViewId(null); qc.removeQueries({ queryKey: ['festival', viewId] }) }}
        >
          {!detail ? (
            <p className={styles.hint}>Loading…</p>
          ) : (
            <DetailView
              festival={detail}
              onEdit={() => {
                setViewId(null)
                openEdit(detail)
              }}
              onClose={() => { setViewId(null); qc.removeQueries({ queryKey: ['festival', viewId] }) }}
            />
          )}
        </Modal>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────── */}
      {deleteTarget && (
        <Modal title="Delete Festival" onClose={() => setDeleteTarget(null)}>
          <p>
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
          </p>
          {deleteTarget._count.payments > 0 && (
            <p className={styles.error}>
              Cannot delete — this festival has {deleteTarget._count.payments} payment(s) recorded.
            </p>
          )}
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              className={styles.deleteBtn}
              disabled={deleteMutation.isPending || deleteTarget._count.payments > 0}
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

function DetailView({
  festival,
  onEdit,
  onClose,
}: {
  festival: FestivalDetail
  onEdit: () => void
  onClose: () => void
}) {
  const status = statusLabel(festival)
  return (
    <div className={styles.detail}>
      <div className={styles.detailMeta}>
        <span className={`${styles.badge} ${status.cls}`}>{status.text}</span>
        <span className={styles.detailDates}>{formatDateRange(festival.startDate, festival.endDate)}</span>
        <span className={styles.detailAmount}>₹{Number(festival.fixedAmount).toLocaleString('en-IN')} / family</span>
      </div>

      {festival.description && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>About</div>
          <p className={styles.detailAbout}>{festival.description}</p>
        </div>
      )}

      {(festival.headName || festival.headPhone || festival.phone2 || festival.phone3) && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>Contact</div>
          {festival.headName && <p className={styles.detailHead}>{festival.headName}</p>}
          <div className={styles.detailPhones}>
            {festival.headPhone && <span>{formatPhone(festival.headPhone)}</span>}
            {festival.phone2 && <span>{formatPhone(festival.phone2)}</span>}
            {festival.phone3 && <span>{formatPhone(festival.phone3)}</span>}
          </div>
        </div>
      )}

      {festival.agenda.length > 0 && (
        <div className={styles.detailSection}>
          <div className={styles.detailSectionTitle}>Agenda ({festival.agenda.length} days)</div>
          <ul className={styles.agendaList}>
            {festival.agenda.map((a, i) => (
              <li key={a.id} className={styles.agendaItem}>
                <span className={styles.agendaDay}>Day {i + 1}</span>
                <span className={styles.agendaDate}>{formatDate(a.date)}</span>
                {a.title && <span className={styles.agendaTitle}>{a.title}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.formActions}>
        <button className={styles.editBtn} onClick={onEdit}>
          Edit Festival
        </button>
        <button className={styles.cancelBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
