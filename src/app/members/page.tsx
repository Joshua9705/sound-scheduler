"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Plus,
  X,
  Save,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import AdminGuard from "@/components/AdminGuard";

interface Role {
  id: number;
  name: string;
}

interface Slot {
  id: number;
  name: string;
  day_of_week: number;
}

interface MemberRole {
  role_id: number;
  is_learning: boolean;
  priority?: number;
}

interface Member {
  id: number;
  name: string;
  level: number;
  active: number;
  slot_ids: string; // comma-separated
  slot_names: string; // comma-separated
  role_info: string; // "id:name:is_learning" comma-separated
  max_override: number | null;
  is_fallback: number;
  preferred_slot_id: number | null;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "⭐ 資深",
  2: "🔵 進階",
  3: "🟢 一般",
  4: "🔰 新手",
};

function parseSlotIds(slot_ids: string | null): number[] {
  if (!slot_ids) return [];
  return slot_ids
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));
}

function parseRoleInfo(role_info: string | null): { roleId: number; name: string; isLearning: boolean; priority: number }[] {
  if (!role_info) return [];
  return role_info
    .split(",")
    .map((r) => {
      const parts = r.trim().split(":");
      if (parts.length < 3) return null;
      return {
        roleId: parseInt(parts[0]),
        name: parts[1],
        isLearning: parts[2] === "1",
        priority: parts[3] ? parseInt(parts[3]) : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.priority || 99) - (b!.priority || 99)) as { roleId: number; name: string; isLearning: boolean; priority: number }[];
}

interface EditState {
  id?: number;
  name: string;
  level: number;
  active: boolean;
  slot_ids: number[];
  roles: MemberRole[];
  max_override: number | null;
  is_fallback: boolean;
  preferred_slot_id: number | null;
}

const emptyEdit = (): EditState => ({
  name: "",
  level: 3,
  active: true,
  slot_ids: [],
  roles: [],
  max_override: null,
  is_fallback: false,
  preferred_slot_id: null,
});

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [editState, setEditState] = useState<EditState>(emptyEdit());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, slotsRes, rolesRes] = await Promise.all([
        fetch("/api/members").then((r) => r.json()),
        fetch("/api/slots").then((r) => r.json()),
        fetch("/api/roles").then((r) => r.json()),
      ]);
      setMembers(membersRes);
      setSlots(slotsRes);
      setRoles(rolesRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function startEdit(member: Member) {
    setEditingId(member.id);
    setEditState({
      id: member.id,
      name: member.name,
      level: member.level,
      active: member.active === 1 || (member.active as any) === true,
      slot_ids: parseSlotIds(member.slot_ids),
      roles: parseRoleInfo(member.role_info).map((r) => ({
        role_id: r.roleId,
        is_learning: r.isLearning,
        priority: r.priority,
      })),
      max_override: member.max_override ?? null,
      is_fallback: member.is_fallback === 1 || (member.is_fallback as any) === true,
      preferred_slot_id: member.preferred_slot_id ?? null,
    });
  }

  function startAdd() {
    setEditingId("new");
    setEditState(emptyEdit());
  }

  function cancelEdit() {
    setEditingId(null);
    setDeleteConfirmId(null);
  }

  async function saveMember() {
    setSaving(true);
    try {
      const payload = {
        ...(editState.id ? { id: editState.id } : {}),
        name: editState.name,
        level: editState.level,
        active: editState.active,
        slot_ids: editState.slot_ids,
        roles: editState.roles.map((r, i) => ({ ...r, priority: i + 1 })),
        max_override: editState.max_override,
        is_fallback: editState.is_fallback,
        preferred_slot_id: editState.preferred_slot_id,
      };

      const method = editState.id ? "PUT" : "POST";
      const res = await fetch("/api/members", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      setEditingId(null);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(id: number) {
    setSaving(true);
    try {
      const res = await fetch(`/api/members?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setDeleteConfirmId(null);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  function toggleSlot(slotId: number) {
    setEditState((prev) => ({
      ...prev,
      slot_ids: prev.slot_ids.includes(slotId)
        ? prev.slot_ids.filter((id) => id !== slotId)
        : [...prev.slot_ids, slotId],
    }));
  }

  function toggleRole(roleId: number) {
    setEditState((prev) => {
      const existing = prev.roles.find((r) => r.role_id === roleId);
      if (existing) {
        return { ...prev, roles: prev.roles.filter((r) => r.role_id !== roleId) };
      } else {
        return { ...prev, roles: [...prev.roles, { role_id: roleId, is_learning: false, priority: prev.roles.length + 1 }] };
      }
    });
  }

  function moveRoleInList(index: number, direction: -1 | 1) {
    setEditState((prev) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.roles.length) return prev;
      const newRoles = [...prev.roles];
      [newRoles[index], newRoles[newIndex]] = [newRoles[newIndex], newRoles[index]];
      return { ...prev, roles: newRoles };
    });
  }

  const circledNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

  function toggleLearning(roleId: number) {
    setEditState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) =>
        r.role_id === roleId ? { ...r, is_learning: !r.is_learning } : r
      ),
    }));
  }

  // Edit form panel
  const EditForm = () => (
    <div className="bg-zinc-900/70 border border-zinc-700/50 rounded-2xl p-5 space-y-5">
      <h3 className="text-lg font-semibold text-zinc-100">
        {editingId === "new" ? "➕ 新增成員" : "✏️ 編輯成員"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">姓名</label>
          <input
            type="text"
            value={editState.name}
            onChange={(e) => setEditState((p) => ({ ...p, name: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            placeholder="輸入姓名"
          />
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">等級</label>
          <select
            value={editState.level}
            onChange={(e) => setEditState((p) => ({ ...p, level: Number(e.target.value) }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
          >
            <option value={1}>⭐ 資深</option>
            <option value={2}>🔵 進階</option>
            <option value={3}>🟢 一般</option>
            <option value={4}>🔰 新手</option>
          </select>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-400">狀態</label>
        <button
          type="button"
          onClick={() => setEditState((p) => ({ ...p, active: !p.active }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            editState.active ? "bg-emerald-500" : "bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              editState.active ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-xs text-zinc-300">{editState.active ? "活躍" : "停用"}</span>
      </div>

      {/* Time Slots */}
      <div>
        <label className="block text-xs text-zinc-400 mb-2">可服事時段</label>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            const selected = editState.slot_ids.includes(slot.id);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => toggleSlot(slot.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  selected
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {slot.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Roles */}
      <div>
        <label className="block text-xs text-zinc-400 mb-2">角色能力</label>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => {
            const memberRole = editState.roles.find((r) => r.role_id === role.id);
            const selected = !!memberRole;
            return (
              <div key={role.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    selected
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {role.name}
                </button>
                {selected && (
                  <button
                    type="button"
                    onClick={() => toggleLearning(role.id)}
                    title="切換學習中"
                    className={`px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                      memberRole?.is_learning
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-zinc-800 border-zinc-600 text-zinc-500"
                    }`}
                  >
                    學
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Role priority ordering */}
      {editState.roles.length > 1 && (
        <div>
          <label className="block text-xs text-zinc-400 mb-2">角色偏好順序（上方 = 優先）</label>
          <div className="space-y-1.5">
            {editState.roles.map((r, i) => {
              const roleName = roles.find((role) => role.id === r.role_id)?.name || `角色${r.role_id}`;
              return (
                <div key={r.role_id} className="flex items-center gap-2 bg-zinc-800/60 rounded-lg px-3 py-2">
                  <span className="text-blue-400 font-bold text-sm w-5">{circledNums[i] || `${i+1}.`}</span>
                  <span className="text-sm text-zinc-200 flex-1">
                    {roleName}
                    {r.is_learning && <span className="text-purple-400 text-xs ml-1">(學)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveRoleInList(i, -1)}
                    disabled={i === 0}
                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRoleInList(i, 1)}
                    disabled={i === editState.roles.length - 1}
                    className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scheduling rules */}
      <div className="border-t border-zinc-800 pt-4 space-y-4">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">排班規則</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* max_override */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">每月上限覆蓋</label>
            <input
              type="number"
              min={0}
              value={editState.max_override ?? ""}
              onChange={(e) =>
                setEditState((p) => ({
                  ...p,
                  max_override: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
              placeholder="使用預設"
            />
          </div>

          {/* preferred_slot_id */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">偏好時段</label>
            <select
              value={editState.preferred_slot_id ?? ""}
              onChange={(e) =>
                setEditState((p) => ({
                  ...p,
                  preferred_slot_id: e.target.value === "" ? null : Number(e.target.value),
                }))
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">無偏好</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* is_fallback */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-zinc-400">後補人員</label>
          <button
            type="button"
            onClick={() => setEditState((p) => ({ ...p, is_fallback: !p.is_fallback }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              editState.is_fallback ? "bg-amber-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                editState.is_fallback ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-xs text-zinc-400">
            {editState.is_fallback ? "是（人手不足時自動補位，不受月限制）" : "否"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={saveMember}
          disabled={saving || !editState.name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          儲存
        </button>
        <button
          onClick={cancelEdit}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          取消
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <AdminGuard>
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">👥 人員管理</h2>
          <p className="text-zinc-500 mt-3 text-base">管理音控團隊成員、服事時段與角色能力。</p>
        </div>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" />
            新增成員
          </button>
        )}
      </header>

      {/* Edit/Add form */}
      {editingId !== null && <EditForm />}

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {members.map((member) => {
          const slotNames = member.slot_names ? member.slot_names.split(",") : [];
          const roleInfos = parseRoleInfo(member.role_info);
          const isActive = member.active === 1 || (member.active as any) === true;
          const isEditing = editingId === member.id;

          return (
            <div
              key={member.id}
              className={`bg-zinc-900/50 rounded-2xl border transition-colors p-5 ${
                isEditing ? "border-blue-500/40" : "border-zinc-800/50"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold shadow-md flex-shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-xs text-zinc-500">{LEVEL_LABELS[member.level]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isActive ? (
                    <span className="text-emerald-400 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />활躍
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-xs flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />停用
                    </span>
                  )}
                  <button
                    onClick={() => (isEditing ? cancelEdit() : startEdit(member))}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isEditing
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                    }`}
                  >
                    {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  </button>
                  {deleteConfirmId === member.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteMember(member.id)}
                        disabled={saving}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                      >
                        確認
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(member.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[11px] text-zinc-600 block mb-1">可服事時段</span>
                  <div className="flex flex-wrap gap-1.5">
                    {slotNames.length > 0 ? (
                      slotNames.map((slot, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-xs text-zinc-300"
                        >
                          {slot}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-600 block mb-1">角色能力</span>
                  <div className="flex flex-wrap gap-1.5">
                    {roleInfos.length > 0 ? (
                      roleInfos.map((r, i) => (
                        <span
                          key={i}
                          className={`px-2.5 py-1 rounded-lg text-xs border ${
                            r.isLearning
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          }`}
                        >
                          <span className="text-blue-400 font-bold mr-0.5">{circledNums[i] || `${i+1}.`}</span>
                          {r.name}
                          {r.isLearning && "(學)"}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </div>
                </div>
                {(member.is_fallback === 1 || member.preferred_slot_id) && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(member.is_fallback === 1 || (member.is_fallback as any) === true) && (
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                        後補人員
                      </span>
                    )}
                    {member.preferred_slot_id && (
                      <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-300">
                        偏好: {slots.find((s) => s.id === member.preferred_slot_id)?.name || `時段${member.preferred_slot_id}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/30 border-b border-zinc-800/50">
              <tr>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">姓名</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400 text-center">等級</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400 text-center">狀態</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">可服事時段</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">角色能力</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400">排班規則</th>
                <th className="px-6 py-4 font-semibold text-sm text-zinc-400 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {members.map((member) => {
                const slotNames = member.slot_names ? member.slot_names.split(",") : [];
                const roleInfos = parseRoleInfo(member.role_info);
                const isActive = member.active === 1 || (member.active as any) === true;
                const isEditing = editingId === member.id;

                return (
                  <tr
                    key={member.id}
                    className={`transition-colors ${isEditing ? "bg-blue-950/20" : "hover:bg-zinc-800/20"}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold shadow-md">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm">{LEVEL_LABELS[member.level]}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />活躍
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-zinc-600 text-sm">
                          <XCircle className="w-4 h-4" />停用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {slotNames.length > 0 ? (
                          slotNames.map((slot, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded-lg text-xs text-zinc-300"
                            >
                              {slot}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-700 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {roleInfos.length > 0 ? (
                          roleInfos.map((r, i) => (
                            <span
                              key={i}
                              className={`px-2.5 py-1 rounded-lg text-xs border ${
                                r.isLearning
                                  ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                                  : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              }`}
                            >
                              <span className="text-blue-400 font-bold mr-0.5">{circledNums[i] || `${i+1}.`}</span>
                              {r.name}
                              {r.isLearning && "(學)"}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-700 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(member.is_fallback === 1 || (member.is_fallback as any) === true) && (
                          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                            後補
                          </span>
                        )}
                        {member.preferred_slot_id && (
                          <span className="px-2.5 py-1 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-300">
                            偏好: {slots.find((s) => s.id === member.preferred_slot_id)?.name || `#${member.preferred_slot_id}`}
                          </span>
                        )}
                        {member.max_override !== null && member.max_override !== undefined && (
                          <span className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-300">
                            上限: {member.max_override}
                          </span>
                        )}
                        {!(member.is_fallback === 1 || (member.is_fallback as any) === true) &&
                          !member.preferred_slot_id &&
                          (member.max_override === null || member.max_override === undefined) && (
                            <span className="text-zinc-700 text-xs">—</span>
                          )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => (isEditing ? cancelEdit() : startEdit(member))}
                          className={`p-2 rounded-lg transition-colors ${
                            isEditing
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                          }`}
                          title={isEditing ? "取消編輯" : "編輯"}
                        >
                          {isEditing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </button>
                        {deleteConfirmId === member.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMember(member.id)}
                              disabled={saving}
                              className="px-2.5 py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                              確認刪除
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(member.id)}
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 transition-colors"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </AdminGuard>
  );
}
