window.AD_CONFIG = {
  // Keep false until real ad units/provider are connected.
  enabled: false,

  // Placeholder mode keeps the game flow testable before real ads exist.
  placeholderMode: true,

  // Fill these later.
  web: {
    bannerSlotId: "",
    interstitialSlotId: "",
    rewardedSlotId: ""
  },

  android: {
    appId: "",
    bannerAdUnitId: "",
    interstitialAdUnitId: "",
    rewardedAdUnitId: ""
  },

  rules: {
    // Natural-break interstitials only.
    interstitialEveryCompletedLevels: 2,

    // Rewarded revive is optional and user-triggered.
    rewardedReviveEnabled: true,

    // Banner appears only on menu-type screens, never over gameplay.
    bannerOnMenusOnly: true
  }
};

class AdManager {
  constructor(config = window.AD_CONFIG) {
    this.config = config;
    this.completedSinceInterstitial = 0;
    this.bannerEl = document.getElementById("adBanner");
    this.adOverlay = document.getElementById("adOverlay");
    this.adOverlayTitle = document.getElementById("adOverlayTitle");
    this.adOverlayText = document.getElementById("adOverlayText");
    this.adOverlayClose = document.getElementById("adOverlayClose");
    this.rewardResolve = null;

    if (this.adOverlayClose) {
      this.adOverlayClose.addEventListener("click", () => {
        this.closePlaceholderOverlay(false);
      });
    }
  }

  isCapacitor() {
    return Boolean(window.Capacitor);
  }

  showMenuBanner() {
    if (!this.bannerEl) return;

    if (!this.config.rules.bannerOnMenusOnly) {
      this.bannerEl.classList.add("hidden");
      return;
    }

    this.bannerEl.classList.remove("hidden");

    if (this.config.enabled) {
      // REAL ADS LATER:
      // Web: mount your banner provider in #adBanner.
      // Android/Capacitor: call your mobile ads plugin here.
      this.bannerEl.innerHTML = `
        <span class="ad-label">AD</span>
        <span>Banner slot ready</span>
      `;
    } else {
      this.bannerEl.innerHTML = `
        <span class="ad-label">AD PLACEHOLDER</span>
        <span>Banner ad will appear here later</span>
      `;
    }
  }

  hideBanner() {
    if (!this.bannerEl) return;
    this.bannerEl.classList.add("hidden");
  }

  async showInterstitial(reason = "level-complete") {
    if (!this.config.enabled && !this.config.placeholderMode) return true;

    if (this.config.enabled) {
      // REAL ADS LATER:
      // Call provider/plugin interstitial here and await dismissal.
      return true;
    }

    return this.showPlaceholderOverlay({
      title: "AD BREAK",
      text: "Interstitial placeholder. A real ad can be shown here between levels.",
      reward: false
    });
  }

  async maybeShowLevelInterstitial() {
    this.completedSinceInterstitial++;

    const every = Math.max(
      1,
      this.config.rules.interstitialEveryCompletedLevels || 2
    );

    if (this.completedSinceInterstitial < every) return true;

    this.completedSinceInterstitial = 0;
    return this.showInterstitial("level-complete");
  }

  async showRewardedRevive() {
    if (!this.config.rules.rewardedReviveEnabled) return false;

    if (this.config.enabled) {
      // REAL ADS LATER:
      // Call rewarded provider/plugin and return true only when
      // the provider confirms the reward was earned.
      return false;
    }

    if (!this.config.placeholderMode) return false;

    return this.showPlaceholderOverlay({
      title: "REWARDED AD",
      text: "Placeholder rewarded ad. Continue to simulate watching the full ad and earn one revive.",
      reward: true
    });
  }

  showPlaceholderOverlay({ title, text, reward }) {
    if (!this.adOverlay) return Promise.resolve(Boolean(reward));

    this.adOverlayTitle.textContent = title;
    this.adOverlayText.textContent = text;
    this.adOverlayClose.textContent = reward ? "Complete Placeholder Ad" : "Continue";
    this.adOverlay.classList.remove("hidden");

    return new Promise((resolve) => {
      this.rewardResolve = { resolve, reward };
    });
  }

  closePlaceholderOverlay(cancelled = false) {
    if (!this.adOverlay) return;

    this.adOverlay.classList.add("hidden");

    if (this.rewardResolve) {
      const { resolve, reward } = this.rewardResolve;
      this.rewardResolve = null;
      resolve(cancelled ? false : Boolean(reward || true));
    }
  }
}
