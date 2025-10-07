// Constants
const DAYS_IN_MONTH = 31;
const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Cache DOM elements
const elements = {
  form: document.getElementById("budget-form"),
  monthlyTemplate: document.getElementById("monthly-expense-template"),
  monthlyContainer: document.getElementById("monthly-expenses-container"),
  addMonthlyButton: document.getElementById("add-monthly-expense"),
  weeklyTemplate: document.getElementById("weekly-expense-template"),
  weeklyContainer: document.getElementById("weekly-expenses-container"),
  addWeeklyButton: document.getElementById("add-weekly-expense"),
  dailyTemplate: document.getElementById("daily-expense-template"),
  dailyContainer: document.getElementById("daily-expenses-container"),
  addDailyButton: document.getElementById("add-daily-expense"),
  monthlyTotal: document.getElementById("monthly-total"),
  paydayTotal: document.getElementById("payday-total"),
  payDayInput: document.querySelector('select[name="pay-day"]'),
};

// Currency formatter
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// Helper function to create expense items
const createExpenseItem = (template, data = {}) => {
  const clone = template.content.cloneNode(true);

  Object.entries(data).forEach(([key, value]) => {
    const input = clone.querySelector(`[name="${key}"]`);
    if (input) input.value = value;
  });

  return clone;
};

// Update totals and save data
const updateAndSave = () => {
  updateTotals();
  saveToLocalStorage();
};

// Event listeners
const { form, addMonthlyButton, addWeeklyButton, addDailyButton } = elements;

// Single event listeners for form changes
["input", "change"].forEach((eventType) =>
  form.addEventListener(eventType, updateAndSave)
);

// Add expense functions
const addExpense = (template, container, nameSelector) => () => {
  const clone = createExpenseItem(template);

  // Add animation class to the expense item before adding to DOM
  const expenseItem = clone.querySelector(".expense-item");
  expenseItem?.classList.add("new-item");

  // Add the cloned element to container
  container.appendChild(clone);

  // Get the newly added element
  const newElement = container.lastElementChild;

  // Trigger the slide-in animation on next frame
  requestAnimationFrame(() => {
    newElement.classList.remove("new-item");
  });

  // Focus the name input
  const nameInput = newElement.querySelector(nameSelector);
  if (nameInput) {
    nameInput.focus();

    // Scroll the new element into view to avoid keyboard overlap
    setTimeout(() => {
      newElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 100); // Small delay to ensure element is rendered
  }

  updateAndSave();
};

// Attach event listeners
addMonthlyButton.addEventListener(
  "click",
  addExpense(
    elements.monthlyTemplate,
    elements.monthlyContainer,
    'input[name="monthly-name"]'
  )
);
addWeeklyButton.addEventListener(
  "click",
  addExpense(
    elements.weeklyTemplate,
    elements.weeklyContainer,
    'input[name="weekly-name"]'
  )
);
addDailyButton.addEventListener(
  "click",
  addExpense(
    elements.dailyTemplate,
    elements.dailyContainer,
    'input[name="daily-name"]'
  )
);

// Remove expense handling using event delegation
form.addEventListener("click", ({ target }) => {
  if (target.classList.contains("remove-expense")) {
    target.closest(".expense-item").remove();
    updateAndSave();
  }
});

// Function to calculate and update totals
const updateTotals = () => {
  const formData = new FormData(elements.form);

  // Calculate total monthly cost using reduce and modern syntax
  const multipliers = {
    "monthly-amount": 1,
    "weekly-amount": DAYS_IN_MONTH / DAYS_IN_WEEK,
    "daily-amount": DAYS_IN_MONTH,
  };

  const monthlyTotal = [...formData.entries()]
    .filter(([name]) => name.endsWith("-amount"))
    .reduce(
      (total, [name, value]) =>
        total + (parseFloat(value) || 0) * (multipliers[name] || 0),
      0
    );

  // Calculate expenses until payday
  const payDay = parseInt(formData.get("pay-day")) || 25;
  const paydayTotal = calculateExpensesUntilPayday(payDay);

  // Update the display using cached elements
  elements.monthlyTotal.textContent = formatCurrency(monthlyTotal);
  elements.paydayTotal.textContent = formatCurrency(paydayTotal);
};

const calculateExpensesUntilPayday = (payDay) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Determine payday date using ternary operator
  const payDayDate =
    payDay <= currentDay
      ? new Date(currentYear, currentMonth + 1, payDay)
      : new Date(currentYear, currentMonth, payDay);

  // Helper function to get expense amount
  const getExpenseAmount = (expense, selector) =>
    parseFloat(expense.querySelector(selector)?.value || 0);

  // Calculate daily expenses using modern array methods
  const dailyExpenses = [
    ...elements.dailyContainer.querySelectorAll(".expense-item"),
  ].reduce((total, expense) => {
    const amount = getExpenseAmount(expense, 'input[name="daily-amount"]');
    let daysUntilPayday = Math.ceil((payDayDate - today) / MS_PER_DAY);

    // Handle edge case where today is payday
    if (currentDay === payDay && payDayDate.getMonth() === currentMonth) {
      daysUntilPayday = 1;
    }

    return total + amount * Math.max(0, daysUntilPayday);
  }, 0);

  // Calculate weekly expenses
  const weeklyExpenses = [
    ...elements.weeklyContainer.querySelectorAll(".expense-item"),
  ].reduce((total, expense) => {
    const amount = getExpenseAmount(expense, 'input[name="weekly-amount"]');
    const dayOfWeek = expense.querySelector('select[name="weekly-day"]')?.value;

    if (!dayOfWeek) return total;

    const targetDay = parseInt(dayOfWeek);
    let nextOccurrence = new Date(today);

    // Find next occurrence of this day
    while (nextOccurrence.getDay() !== targetDay || nextOccurrence <= today) {
      nextOccurrence.setDate(nextOccurrence.getDate() + 1);
    }

    // Count occurrences before payday
    let occurrences = 0;
    while (nextOccurrence < payDayDate) {
      occurrences++;
      nextOccurrence.setDate(nextOccurrence.getDate() + DAYS_IN_WEEK);
    }

    return total + amount * occurrences;
  }, 0);

  // Calculate monthly expenses
  const monthlyExpenses = [
    ...elements.monthlyContainer.querySelectorAll(".expense-item"),
  ].reduce((total, expense) => {
    const amount = getExpenseAmount(expense, 'input[name="monthly-amount"]');
    const dayOfMonth = parseInt(
      expense.querySelector('select[name="monthly-day"]')?.value || 1
    );

    // Create expense date
    const expenseDate = new Date(currentYear, currentMonth, dayOfMonth);

    // Adjust to next month if day has passed
    if (dayOfMonth <= currentDay) {
      expenseDate.setMonth(expenseDate.getMonth() + 1);
    }

    // Include if occurs before payday
    return expenseDate < payDayDate ? total + amount : total;
  }, 0);

  return dailyExpenses + weeklyExpenses + monthlyExpenses;
};

// Function to extract expense data from DOM elements
const extractExpenseData = (container, fields) =>
  [...container.querySelectorAll(".expense-item")]
    .map((expense) => {
      const data = Object.fromEntries(
        fields.map((field) => [
          field.split("-").pop(),
          expense.querySelector(`[name="${field}"]`)?.value || "",
        ])
      );
      return Object.values(data).some(Boolean) ? data : null;
    })
    .filter(Boolean);

// Function to save data to localStorage
const saveToLocalStorage = () => {
  try {
    const data = {
      monthlyExpenses: extractExpenseData(elements.monthlyContainer, [
        "monthly-name",
        "monthly-amount",
        "monthly-day",
      ]),
      weeklyExpenses: extractExpenseData(elements.weeklyContainer, [
        "weekly-name",
        "weekly-amount",
        "weekly-day",
      ]),
      dailyExpenses: extractExpenseData(elements.dailyContainer, [
        "daily-name",
        "daily-amount",
      ]),
      payDay: new FormData(elements.form).get("pay-day"),
    };

    localStorage.setItem("budgetData", JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save data to localStorage:", error);
  }
};

// Function to load data from localStorage
const loadFromLocalStorage = () => {
  try {
    const savedData = localStorage.getItem("budgetData");
    if (!savedData) return;

    const data = JSON.parse(savedData);

    // Load payday using optional chaining
    if (data.payDay) {
      elements.payDayInput.value = data.payDay;
    }

    // Helper function to load expenses
    const loadExpenses = (expenses, template, container, type) => {
      expenses?.forEach((expense) => {
        const clone = createExpenseItem(template, {
          [`${type}-name`]: expense.name,
          [`${type}-amount`]: expense.amount,
          [`${type}-day`]: expense.day,
        });
        container.appendChild(clone);
      });
    };

    // Load all expense types using destructuring
    const { monthlyExpenses, weeklyExpenses, dailyExpenses } = data;

    loadExpenses(
      monthlyExpenses,
      elements.monthlyTemplate,
      elements.monthlyContainer,
      "monthly"
    );
    loadExpenses(
      weeklyExpenses,
      elements.weeklyTemplate,
      elements.weeklyContainer,
      "weekly"
    );
    loadExpenses(
      dailyExpenses,
      elements.dailyTemplate,
      elements.dailyContainer,
      "daily"
    );

    // Update totals after loading
    updateTotals();
  } catch (error) {
    console.error("Failed to load data from localStorage:", error);
  }
};

// Load saved data when page loads
loadFromLocalStorage();
