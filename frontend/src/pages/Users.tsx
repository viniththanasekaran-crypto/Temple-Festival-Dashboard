import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import Modal from '../components/Modal'
import {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  type AdminUser,
  type CreateUserPayload,
} from '../api/users'
import { getTemples } from '../api/temples'
import { formatPhone, toE164, fromE164 } from '../utils/phone'
import styles from './Users.module.css'

type ModalMode = 'add' | 'edit' | null
type RoleFilter = 'all' | 'super_admin' | 'admin'

interface FormState {
  username: string
  name: string
  phone: string // 10-digit, no +91 prefix
  role: 'super_admin' | 'admin'
  templeIds: number[] // admins can manage many temples
}

const EMPTY_FORM: FormState = { username: '', name: '', phone: '', role: 'admin', templeIds: [] }

export default function Users() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [formError, setFormError] = useState('')
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: temples = [] } = useQuery({ queryKey: ['temples'], queryFn: getTemples })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: ({ password }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      closeModal()
      setCreatedPassword(password)
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setFormError(e.response?.data?.message ?? 'Failed to update user'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setDeactivateTarget(null)
    },
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError('')
    setModal('add')
  }

  function openEdit(user: AdminUser) {
    setSelected(user)
    setForm({
      username: user.username,
      name: user.name ?? '',
      phone: fromE164(user.phone ?? ''), // strip +91 for the input
      role: user.role.name as 'super_admin' | 'admin',
      templeIds: user.temples.map((t) => t.id),
    })
    setFormError('')
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
    setFormError('')
  }

  function handlePhoneChange(raw: string) {
    // Allow only digits, max 10
    setForm({ ...form, phone: raw.replace(/\D/g, '').slice(0, 10) })
  }

  function toggleTemple(id: number, checked: boolean) {
    setForm((f) => ({
      ...f,
      templeIds: checked ? [...f.templeIds, id] : f.templeIds.filter((t) => t !== id),
    }))
  }

  function buildPhoneE164(): string | undefined {
    if (!form.phone) return undefined
    const e164 = toE164(form.phone)
    return e164 || undefined
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (form.phone && form.phone.length !== 10) {
      setFormError('Phone must be exactly 10 digits')
      return
    }
    if (form.role === 'admin' && form.templeIds.length === 0) {
      setFormError('At least one temple is required for admin role')
      return
    }
    const phone = buildPhoneE164()
    if (modal === 'add') {
      const payload: CreateUserPayload = {
        username: form.username,
        role: form.role,
        ...(form.name && { name: form.name }),
        ...(phone && { phone }),
        ...(form.role === 'admin' ? { templeIds: form.templeIds } : {}),
      }
      createMutation.mutate(payload)
    } else if (selected) {
      updateMutation.mutate({
        id: selected.id,
        payload: {
          name: form.name,
          phone,
          role: form.role,
          templeIds: form.role === 'super_admin' ? [] : form.templeIds,
        },
      })
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role.name === roleFilter
    return matchSearch && matchRole
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className={styles.page}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.toolbar}>
          <h1 className={styles.heading}>Users</h1>
          <div className={styles.toolbarRight}>
            <input
              className={styles.search}
              placeholder="Search by username or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.roleSelect}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            >
              <option value="all">All roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
            </select>
            <button className={styles.addBtn} onClick={openAdd}>
              + Add User
            </button>
          </div>
        </div>

        {isLoading && <p className={styles.hint}>Loading…</p>}
        {!isLoading && filtered.length === 0 && <p className={styles.hint}>No users found.</p>}

        {filtered.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name / Username</th>
                  <th>Role</th>
                  <th>Temple</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className={!user.isActive ? styles.inactiveRow : ''}>
                    <td>
                      <div className={styles.nameCell}>
                        <span className={styles.name}>{user.name || '—'}</span>
                        <span className={styles.username}>@{user.username}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.roleBadge} data-role={user.role.name}>
                        {user.role.name === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td>
                      {user.temples.length ? user.temples.map((t) => t.name).join(', ') : '—'}
                    </td>
                    <td>{user.phone ? formatPhone(user.phone) : '—'}</td>
                    <td>
                      <span className={user.isActive ? styles.active : styles.inactive}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button className={styles.editBtn} onClick={() => openEdit(user)}>
                          Edit
                        </button>
                        {user.isActive && (
                          <button
                            className={styles.deactivateBtn}
                            onClick={() => setDeactivateTarget(user)}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {modal && (
        <Modal title={modal === 'add' ? 'Add User' : 'Edit User'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {modal === 'add' && (
              <label>
                Username *
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g. admin_madurai"
                />
              </label>
            )}
            <label>
              Full Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. முருகன் க"
              />
            </label>
            <label>
              Phone
              <div className={styles.phoneRow}>
                <span className={styles.phonePrefix}>+91</span>
                <input
                  className={styles.phoneInput}
                  value={form.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="98765 43210"
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              <span className={styles.fieldHint}>Enter 10-digit mobile number</span>
            </label>
            <label>
              Role *
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as 'super_admin' | 'admin',
                    templeIds: [],
                  })
                }
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
            {form.role === 'admin' && (
              <div className={styles.templesField}>
                <span className={styles.templesLabel}>Temples *</span>
                <div className={styles.templeChecklist}>
                  {temples.map((t) => (
                    <label key={t.id} className={styles.templeCheck}>
                      <input
                        type="checkbox"
                        checked={form.templeIds.includes(t.id)}
                        onChange={(e) => toggleTemple(t.id, e.target.checked)}
                      />
                      {t.name}
                    </label>
                  ))}
                  {temples.length === 0 && (
                    <p className={styles.hint}>No temples yet — create one first.</p>
                  )}
                </div>
              </div>
            )}
            {formError && <p className={styles.error}>{formError}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.submitBtn} disabled={isPending}>
                {isPending ? 'Saving…' : modal === 'add' ? 'Create User' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {createdPassword && (
        <Modal title="User Created" onClose={() => setCreatedPassword(null)}>
          <p>User created successfully. Share these credentials:</p>
          <div className={styles.credBox}>
            <p>
              <strong>Password:</strong> {createdPassword}
            </p>
          </div>
          <p className={styles.credNote}>This password will not be shown again. Copy it now.</p>
          <div className={styles.formActions}>
            <button className={styles.submitBtn} onClick={() => setCreatedPassword(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {deactivateTarget && (
        <Modal title="Deactivate User" onClose={() => setDeactivateTarget(null)}>
          <p>
            Deactivate <strong>{deactivateTarget.name || deactivateTarget.username}</strong>? They
            will no longer be able to log in.
          </p>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setDeactivateTarget(null)}>
              Cancel
            </button>
            <button
              className={styles.deactivateBtn}
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(deactivateTarget.id)}
            >
              {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
