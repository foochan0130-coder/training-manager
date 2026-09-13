// マシン器具の重量管理ロジック(プランの項目に対する重量表示・追加・増減・削除)。

export function weightForItem(item, equipment) {
  if (item.fixed) return item.fixed;
  const eq = equipment.find((e) => e.name === item.name);
  return eq ? `${eq.weight}kg` : "—";
}

export function addEquipmentItem(equipment, name, weight, todayKey) {
  return [...equipment, { id: Date.now().toString(36), name, weight, updated: todayKey }];
}

export function changeEquipmentWeight(equipment, id, delta, todayKey) {
  return equipment.map((e) =>
    e.id === id
      ? { ...e, weight: Math.max(0, Math.round((e.weight + delta) * 100) / 100), updated: todayKey }
      : e
  );
}

export function removeEquipmentItem(equipment, id) {
  return equipment.filter((e) => e.id !== id);
}
