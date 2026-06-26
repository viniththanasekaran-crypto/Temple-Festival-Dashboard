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
import styles from './Users.module.css'

type ModalMode = 'add' | 'edit' | null
type RoleFilter = 'all' | 'super_admin' | 'admin'

const EMPTY_FORM: CreateUserPayload = { username: '', name: '', phone: '', role: 'admin' }

export default function Users() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<CreateUserPayload>(EMPTY_FORM)
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
      phone: user.phone ?? '',
      role: user.role.name as 'super_admin' | 'admin',
      templeId: user.temple?.id,
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
    if (form.role === 'admin' && !form.templeId) {
      setFormError('Temple is required for admin role')
      return
    }
    if (modal === 'add') {
      const payload: CreateUserPayload = {
        username: form.username,
        role: form.role,
        ...(form.name && { name: form.name }),
        ...(form.phone && { phone: form.phone }),
        ...(form.role === 'admin' && form.templeId ? { templeId: form.templeId } : {}),
      }
      createMutation.mutate(payload)
    } else if (selected) {
      const payload = {
        ...(form.name !== undefined && { name: form.name }),
        ...(form.phone !== undefined && { phone: form.phone }),
        role: form.role,
        templeId: form.role === 'super_admin' ? null : form.templeId,
      }
      updateMutation.mutate({ id: selected.id, payload })
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
                    <td>{user.temple?.name ?? '—'}</td>
                    <td>{user.phone ?? '—'}</td>
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
                placeholder="e.g. Murugan K"
              />
            </label>
            <label>
              Phone (+91XXXXXXXXXX)
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+919876543210"
              />
            </label>
            <label>
              Role *
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as 'super_admin' | 'admin',
                    templeId: undefined,
                  })
                }
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
            {form.role === 'admin' && (
              <label>
                Temple *
                <select
                  required
                  value={form.templeId ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, templeId: Number(e.target.value) || undefined })
                  }
                >
                  <option value="">Select temple…</option>
                  {temples.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
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
