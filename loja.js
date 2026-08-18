const storeYear = document.querySelector("[data-store-year]");
const planButtons = [...document.querySelectorAll("[data-plan-select]")];
const planSelection = document.querySelector("[data-plan-selection]");
const selectedPlan = document.querySelector("[data-selected-plan]");
const selectedPrice = document.querySelector("[data-selected-price]");
const selectedPlanKey = "rps_store_selected_plan";

if (storeYear) {
  storeYear.textContent = new Date().getFullYear();
}

const formatMv = (value) => `${new Intl.NumberFormat("pt-BR").format(Number(value) || 0)} MV`;

const selectPlan = (button, shouldScroll = true) => {
  if (!button || !planSelection || !selectedPlan || !selectedPrice) return;

  planButtons.forEach((planButton) => {
    const isSelected = planButton === button;
    planButton.setAttribute("aria-pressed", String(isSelected));
    planButton.textContent = isSelected ? "Plano selecionado" : "Escolher plano";
  });

  const plan = {
    id: button.dataset.planId,
    name: button.dataset.planName,
    price: Number(button.dataset.planPrice) || 0,
  };

  sessionStorage.setItem(selectedPlanKey, JSON.stringify(plan));
  selectedPlan.textContent = plan.name;
  selectedPrice.textContent = formatMv(plan.price);
  planSelection.hidden = false;

  if (shouldScroll) {
    planSelection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
};

planButtons.forEach((button) => {
  button.addEventListener("click", () => selectPlan(button));
});

try {
  const savedPlan = JSON.parse(sessionStorage.getItem(selectedPlanKey) || "null");
  const savedButton = planButtons.find((button) => button.dataset.planId === savedPlan?.id);
  if (savedButton) selectPlan(savedButton, false);
} catch {
  sessionStorage.removeItem(selectedPlanKey);
}
