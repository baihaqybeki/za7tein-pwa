import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, LayoutGrid, Minus, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

import { MerchantBottomNav } from '../components/layout/MerchantBottomNav'
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { useCatalog } from '../hooks/useCatalog'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { CATEGORIES, MENU_LOW_STOCK_THRESHOLD, countLowStock, countOutOfStock } from '../data/catalog'
import { money } from '../data/merchant'
import { imageFileError } from '../lib/image'
import { resolveBackendMerchantId, syncMenuCreate, syncMenuDelete, syncMenuUpdate } from '../api/menuSync'
import { merchantMenuItemSchema, type MerchantMenuItemFormData } from '../lib/schemas'
import { addMenuItem, removeMenuItem, setStock, toggleAvailable, updateMenuItem } from '../store/slices/catalogSlice'
import type { MenuItem } from '../types'

const EMPTY_FORM: MerchantMenuItemFormData = { name: '', price: 0, category: '', stock: 0 }
const FALLBACK_IMAGE = '/assets/img/menu-details/menu-details-thumb.png'

export default function MerchantMenu() {
  const dispatch = useAppDispatch()
  const { items } = useCatalog()
  const isActive = useAppSelector((state) => state.merchant.isActive)
  const storeName = useAppSelector((state) => state.merchant.storeName)
  const storeId = useAppSelector((state) => state.merchant.id)
  /** Petakan merchant mock (mis. am-1) ke merchant backend lalu sinkronkan CRUD. */
  const sync = (fn: (merchantId: number) => Promise<boolean>) => {
    void (async () => {
      const mid = await resolveBackendMerchantId(storeId, storeName)
      if (mid) await fn(mid)
    })()
  }

  const lowCount = countLowStock(items)
  const outCount = countOutOfStock(items)
  const readyCount = items.filter((item) => item.available && item.stock > 0).length
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')
  const [category, setCategory] = useState<'all' | string>('all')
  const visibleItems = items.filter((item) =>
    (category === 'all' || item.category === category) &&
    (stockFilter === 'out' ? item.stock <= 0 :
      stockFilter === 'low' ? item.stock > 0 && item.stock <= MENU_LOW_STOCK_THRESHOLD : true),
  )
  /* Daftar dikelompokkan per kategori (mock CATEGORIES), urutannya tetap;
     grup yang kosong setelah filter stok disembunyikan. */
  const menuGroups = CATEGORIES
    .map((category) => ({
      category,
      items: visibleItems.filter((item) => item.category === category.id),
    }))
    .filter((group) => group.items.length > 0)

  const [overflowId, setOverflowId] = useState<string | null>(null)
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null)
  /* Menyembunyikan item menghilangkannya dari menu pelanggan; salah sentuh di
     sini = menu jualan berkurang tanpa disadari. Tampilkan kembali cukup 1 tap. */
  const [hideTarget, setHideTarget] = useState<MenuItem | null>(null)

  /* ── stock sheet ── */
  const [stockItem, setStockItem] = useState<MenuItem | null>(null)
  const [stockDraft, setStockDraft] = useState(0)

  const openStock = (item: MenuItem) => {
    setStockItem(item)
    setStockDraft(item.stock)
    setOverflowId(null)
  }

  const closeStock = () => {
    setStockItem(null)
    setStockDraft(0)
  }

  const saveStock = () => {
    if (stockItem) {
      dispatch(setStock({ id: stockItem.id, stock: stockDraft }))
      const item = stockItem
      sync((mid) => syncMenuUpdate(mid, item.name, { stock: stockDraft }))
    }
    closeStock()
  }

  /* ── add/edit sheet ── */
  const [sheetMode, setSheetMode] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [formImage, setFormImage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MerchantMenuItemFormData>({
    resolver: zodResolver(merchantMenuItemSchema),
    defaultValues: EMPTY_FORM,
  })

  const openAdd = () => {
    reset(EMPTY_FORM)
    setFormImage(null)
    setEditing(null)
    setSheetMode('add')
    setOverflowId(null)
  }

  const openEdit = (item: MenuItem) => {
    reset({
      name: item.name,
      price: item.price,
      category: item.category,
      stock: item.stock,
      description: item.description ?? '',
    })
    setFormImage(item.image)
    setEditing(item)
    setSheetMode('edit')
  }

  const closeSheet = () => {
    setSheetMode(null)
    setEditing(null)
    setFormImage(null)
  }

  const onSubmit = (data: MerchantMenuItemFormData) => {
    if (sheetMode === 'edit' && editing) {
      const patch = {
        ...editing,
        name: data.name,
        price: data.price,
        category: data.category,
        stock: data.stock,
        image: formImage || editing.image,
        description: data.description ?? editing.description,
      }
      dispatch(updateMenuItem(patch))
      sync((mid) => syncMenuUpdate(mid, editing.name, patch))
    } else {
      const created: MenuItem = {
        id: crypto.randomUUID(),
        name: data.name,
        price: data.price,
        category: data.category,
        stock: data.stock,
        image: formImage || FALLBACK_IMAGE,
        description: data.description ?? '',
        rating: 5,
        reviewCount: 0,
        deliveryTime: '20-30 min',
        distance: '1.2 km',
        available: true,
      }
      dispatch(addMenuItem(created))
      sync((mid) => syncMenuCreate(mid, created))
    }
    closeSheet()
  }

  const handleImagePick = () => {
    fileRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const error = imageFileError(file)
    if (error) {
      toast.error(error)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => setFormImage(String(reader.result))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  /* ── close overflow on outside click ── */
  useEffect(() => {
    if (!overflowId) return
    const close = () => setOverflowId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [overflowId])

  /* Tinggi bar filter diukur runtime → kepala grup sticky duduk tepat di
     bawahnya. Hardcode `top` pernah bikin tumpang-tindih; ukur, jangan tebak. */
  const filtersRef = useRef<HTMLDivElement>(null)
  const [filterH, setFilterH] = useState(0)
  useEffect(() => {
    const el = filtersRef.current
    if (!el) return
    const update = () => setFilterH(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="app-shell">
      <main className="merchant-page" style={{ '--menu-filter-h': `${filterH}px` } as CSSProperties}>
        <MerchantPageHeader
          eyebrow={storeName}
          title="Menu & Stok"
          action={(
            <button type="button" className="merchant-add-btn" onClick={openAdd}>
              <Plus size={16} strokeWidth={1.75} /> Tambah Item
            </button>
          )}
        />

        <section className="merchant-menu-context" aria-label="Status katalog">
          <span className={`merchant-menu-context-status${isActive ? ' is-open' : ''}`}>
            <span aria-hidden="true" />
            {isActive ? 'Toko buka' : 'Toko tutup'}
          </span>
          <span className="merchant-menu-context-sep" aria-hidden="true">·</span>
          <span className="merchant-menu-context-count">
            {readyCount} dari {items.length} menu siap tampil
          </span>
        </section>

        <div className="merchant-menu-filters" ref={filtersRef}>
          <div className="merchant-menu-chips" role="tablist" aria-label="Filter kategori menu">
            <button
              type="button"
              role="tab"
              aria-selected={category === 'all'}
              className={`merchant-chip${category === 'all' ? ' is-active' : ''}`}
              onClick={(e) => {
                setCategory('all')
                e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' })
              }}
            >
              <LayoutGrid size={15} strokeWidth={1.75} aria-hidden="true" />
              Semua
            </button>
            {CATEGORIES.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  className={`merchant-chip${category === c.id ? ' is-active' : ''}`}
                  onClick={(e) => {
                    setCategory(c.id)
                    e.currentTarget.scrollIntoView({ inline: 'nearest', block: 'nearest' })
                  }}
                >
                  {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden="true" />}
                  {c.label}
                </button>
              )
            })}
          </div>
          <div className="merchant-menu-stockfilter" role="group" aria-label="Filter status stok">
            <button type="button" aria-pressed={stockFilter === 'all'} className={stockFilter === 'all' ? 'is-active' : ''} onClick={() => setStockFilter('all')}>
              Semua stok
            </button>
            <button type="button" aria-pressed={stockFilter === 'low'} className={stockFilter === 'low' ? 'is-active' : ''} onClick={() => setStockFilter('low')}>
              Menipis <em>{lowCount}</em>
            </button>
            <button type="button" aria-pressed={stockFilter === 'out'} className={stockFilter === 'out' ? 'is-active' : ''} onClick={() => setStockFilter('out')}>
              Habis <em>{outCount}</em>
            </button>
          </div>
        </div>

        {visibleItems.length === 0 && (
          <p className="merchant-menu-empty">Belum ada item dalam kategori ini.</p>
        )}
        {menuGroups.map((group) => {
          const GroupIcon = group.category.icon
          return (
            <section
              key={group.category.id}
              className="merchant-menu-group"
              aria-label={group.category.label}
            >
              <div className="merchant-menu-list-head">
                <h2 className="merchant-section-title">
                  {GroupIcon && <GroupIcon size={16} strokeWidth={1.75} aria-hidden="true" />}
                  {group.category.label}
                </h2>
                <span>{group.items.length} item</span>
              </div>
              <div className="merchant-list">
                {group.items.map((item, index) => (
                  <div
                    key={`${stockFilter}-${item.id}`}
                    className={`merchant-menu-item stagger-in${item.available ? '' : ' is-unavailable'}`}
                    style={{ '--stagger-index': index } as CSSProperties}
                  >
                    <div className="merchant-menu-primary">
                      <img className="merchant-menu-thumb" src={item.image} alt={item.name} width={64} height={64} loading="lazy" decoding="async" />
                      <div className="merchant-menu-body">
                        <p className="merchant-menu-row-name">{item.name}</p>
                        <p className="merchant-menu-row-meta">{item.category}</p>
                        <p className="merchant-menu-row-price">{money(item.price)}</p>
                      </div>
                      <div className="merchant-menu-more-wrap">
                        <button
                          type="button"
                          className="merchant-menu-more"
                          aria-label={`Opsi ${item.name}`}
                          onClick={(e) => { e.stopPropagation(); setOverflowId(overflowId === item.id ? null : item.id) }}
                        >
                          <MoreVertical size={18} strokeWidth={1.75} />
                        </button>
                        {overflowId === item.id && (
                          <div className="merchant-overflow" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => { setOverflowId(null); openEdit(item) }}>
                              <Pencil size={16} strokeWidth={1.75} /> Ubah
                            </button>
                            <button type="button" className="is-danger" onClick={() => { setOverflowId(null); setDeleteItem(item) }}>
                              <Trash2 size={16} strokeWidth={1.75} /> Hapus
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="merchant-menu-controls">
                      <button
                        type="button"
                        className={`merchant-menu-stock-btn${item.stock <= 0 ? ' is-out' : item.stock <= MENU_LOW_STOCK_THRESHOLD ? ' is-low' : ''}`}
                        onClick={() => openStock(item)}
                        aria-label={`Atur stok ${item.name}, ${item.stock} tersedia`}
                      >
                        {item.stock <= 0 ? 'Habis · Isi stok' : `Stok ${item.stock} · Ubah`}
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.available}
                        aria-label={`Ketersediaan ${item.name}`}
                        className={`merchant-menu-availability${item.available ? ' is-on' : ''}`}
                        onClick={() => {
                          if (item.available) {
                            setHideTarget(item)
                          } else {
                            dispatch(toggleAvailable(item.id))
                            toast.success(`${item.name} tampil lagi di menu`)
                          }
                        }}
                      >
                        <span>{item.available ? 'Tersedia' : 'Disembunyikan'}</span>
                        <span className="merchant-toggle-switch" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </main>

      <MerchantBottomNav />

      {/* ── stock sheet ── */}
      <BottomSheet open={stockItem !== null} title={stockItem?.name} onClose={closeStock}>
        <p className={`sheet-field-label${stockDraft <= 0 ? ' is-out' : stockDraft !== stockItem?.stock ? ' is-changed' : ''}`}>
          {stockDraft <= 0
            ? 'Stok habis'
            : stockItem && stockDraft !== stockItem.stock
              ? `Dari ${stockItem.stock}`
              : 'Stok saat ini'}
        </p>
        <div className="stock-stepper">
          <button type="button" aria-label="Kurangi stok" onClick={() => setStockDraft((d) => Math.max(0, d - 1))}>
            <Minus size={22} strokeWidth={1.75} />
          </button>
          {/* key: saat angka berubah, span di-remount sehingga animasi pop
              berjalan lagi. Tanpa key, React memakai ulang node dan animasinya
              tidak pernah terpicu. */}
          <span key={stockDraft} className="stock-stepper-value">{stockDraft}</span>
          <button type="button" aria-label="Tambah stok" onClick={() => setStockDraft((d) => d + 1)}>
            <Plus size={22} strokeWidth={1.75} />
          </button>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={saveStock}>Simpan</button>
        </div>
      </BottomSheet>

      {/* ── add/edit sheet ── */}
      <BottomSheet open={sheetMode !== null} title={sheetMode === 'edit' ? 'Ubah Item' : 'Tambah Item'} onClose={closeSheet}>
        <form className="merchant-form" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label htmlFor="merchant-item-name" className="form-label">Nama item</label>
            <input id="merchant-item-name" className={`form-control${errors.name ? ' error' : ''}`} {...register('name')} />
            {errors.name && <span className="error-message">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="merchant-item-price" className="form-label">Harga</label>
            <input id="merchant-item-price" type="number" min="0" className={`form-control${errors.price ? ' error' : ''}`} {...register('price', { valueAsNumber: true })} />
            {errors.price && <span className="error-message">{errors.price.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="merchant-item-category" className="form-label">Kategori</label>
            <select id="merchant-item-category" className={`form-control${errors.category ? ' error' : ''}`} {...register('category')}>
              <option value="">Pilih kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {errors.category && <span className="error-message">{errors.category.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="merchant-item-stock" className="form-label">Stok</label>
            <input id="merchant-item-stock" type="number" min="0" className={`form-control${errors.stock ? ' error' : ''}`} {...register('stock', { valueAsNumber: true })} />
            {errors.stock && <span className="error-message">{errors.stock.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="merchant-item-description" className="form-label">Deskripsi</label>
            <textarea id="merchant-item-description" className="form-control" {...register('description')} />
          </div>
          <div className="form-group">
            <span className="form-label">Gambar</span>
            <div className="merchant-image-field">
              <input ref={fileRef} type="file" accept="image/*" className="d-none" onChange={handleFileChange} />
              {formImage && <img className="merchant-form-thumb" src={formImage} alt="Pratinjau gambar" width={64} height={64} loading="lazy" decoding="async" />}
              <button type="button" className="merchant-btn-ghost" onClick={handleImagePick}>
                <ImagePlus size={16} strokeWidth={1.75} /> {formImage ? 'Ganti gambar' : 'Gambar'}
              </button>
            </div>
          </div>
          <div className="merchant-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>Simpan</button>
            <button type="button" className="merchant-btn-ghost" onClick={closeSheet}>Batal</button>
          </div>
        </form>
      </BottomSheet>

      <ConfirmSheet
        open={deleteItem !== null}
        title="Hapus item menu?"
        body={`${deleteItem?.name ?? ''} akan hilang dari daftar merchant dan menu pelanggan.`}
        confirmLabel="Hapus item"
        onConfirm={() => {
          if (deleteItem) {
            dispatch(removeMenuItem(deleteItem.id))
            const item = deleteItem
            sync((mid) => syncMenuDelete(mid, item.name))
          }
          setDeleteItem(null)
        }}
        onClose={() => setDeleteItem(null)}
      />

      <ConfirmSheet
        open={hideTarget !== null}
        title={`Sembunyikan ${hideTarget?.name ?? 'item'}?`}
        body="Item ini hilang dari menu pelanggan sampai kamu tampilkan lagi. Stok dan datanya tetap tersimpan."
        confirmLabel="Sembunyikan"
        onConfirm={() => {
          if (hideTarget) {
            dispatch(toggleAvailable(hideTarget.id))
            const item = hideTarget
            sync((mid) => syncMenuUpdate(mid, item.name, { available: false }))
            toast.success(`${hideTarget.name} disembunyikan dari menu`)
          }
          setHideTarget(null)
        }}
        onClose={() => setHideTarget(null)}
      />
    </div>
  )
}
