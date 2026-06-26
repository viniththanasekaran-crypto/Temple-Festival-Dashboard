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
  type CreateTemplePayload,
} from '../api/temples'
import styles from './Temples.module.css'

type ModalMode = 'add' | 'edit' | null

const EMPTY_FORM: CreateTemplePayload = {
  name: '',
  deity: '',
  village: '',
  address: '',
  districtId: 0,
}

export default function Temples() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<Temple | null>(null)
  const [form, setForm] = useState<CreateTemplePayload>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Temple | null>(null)

  const { data: temples = [], isLoading } = useQuery({ queryKey: ['temples'], queryFn: getTemples })
  const { data: districts = [] } = useQuery({ queryKey: ['districts'], queryFn: getDistricts })

  const createMutation = useMutation({
    mutationFn: createTemple,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temples'] })
      closeModal()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to create temple'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateTemplePayload> }) =>
      updateTemple(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temples'] })
      closeModal()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to update temple'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTemple,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temples'] })
      setDeleteTarget(null)
    },
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!form.districtId) {
      setFormError('Please select a district')
      return
    }
    const payload: CreateTemplePayload = {
      name: form.name,
      districtId: form.districtId,
      ...(form.deity && { deity: form.deity }),
      ...(form.village && { village: form.village }),
      ...(form.address && { address: form.address }),
    }
    if (modal === 'add') {
      createMutation.mutate(payload)
    } else if (selected) {
      updateMutation.mutate({ id: selected.id, payload })
    }
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
                <p className={styles.cardStats}>
                  {temple._count.festivals} festivals · {temple._count.families} families
                </p>
              </div>
              <div className={styles.cardActions}>
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

      {modal && (
        <Modal title={modal === 'add' ? 'Add Temple' : 'Edit Temple'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label>
              Temple Name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Deity
              <input
                value={form.deity}
                onChange={(e) => setForm({ ...form, deity: e.target.value })}
              />
            </label>
            <label>
              Village
              <input
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
              />
            </label>
            <label>
              Address
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label>
              District *
              <select
                required
                value={form.districtId || ''}
                onChange={(e) => setForm({ ...form, districtId: Number(e.target.value) })}
              >
                <option value="">Select district…</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? 'Saving…' : modal === 'add' ? 'Add Temple' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete Temple" onClose={() => setDeleteTarget(null)}>
          <p>
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be
            undone.
          </p>
          {(deleteTarget._count.festivals > 0 || deleteTarget._count.families > 0) && (
            <p className={styles.error}>
              Cannot delete — this temple has {deleteTarget._count.festivals} festival(s) and{' '}
              {deleteTarget._count.families} family record(s).
            </p>
          )}
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button
              className={styles.deleteBtn}
              disabled={
                deleteMutation.isPending ||
                deleteTarget._count.festivals > 0 ||
                deleteTarget._count.families > 0
              }
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
