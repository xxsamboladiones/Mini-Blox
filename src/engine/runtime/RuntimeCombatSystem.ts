export type RuntimeCombatWeapon = {
  cooldown: number;
};

export class RuntimeCombatSystem {
  private attackCooldown = 0;

  update(deltaSeconds: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
  }

  reset(): void {
    this.attackCooldown = 0;
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  beginAttack(weapon: RuntimeCombatWeapon): void {
    this.attackCooldown = Math.max(0, weapon.cooldown);
  }

  getWeaponCooldownProgress(weapon: RuntimeCombatWeapon | null): number {
    if (!weapon || weapon.cooldown <= 0) {
      return 1;
    }

    return Math.max(0, Math.min(1, 1 - this.attackCooldown / weapon.cooldown));
  }
}
