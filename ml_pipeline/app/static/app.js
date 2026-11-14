
"use strict";

/* =========================================================
   MINDSATHI AI
   Frontend Application
   Flask + HTML + CSS + JavaScript
   ========================================================= */


/* =========================================================
   1. GENERAL HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const escapeHTML = (value) => {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
};


async function api(url, options = {}) {

  const response = await fetch(url, options);

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}


const jsonOptions = (body, method = "POST") => ({
  method,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});


/* =========================================================
   2. NAVIGATION
   ========================================================= */

const TABS = [
  ["home", "Overview"],
  ["today", "Today"],
  ["assessment", "PHQ-9"],
  ["talk", "Saathi"],
  ["insights", "Risk insights"],
  ["help", "Help now"],
  ["privacy", "Privacy"]
];


const nav = $("#nav");


function go(page) {

  const exists = TABS.some(([id]) => id === page);

  const activePage = exists ? page : "home";


  TABS.forEach(([id]) => {

    const section = $("#v-" + id);

    if (section) {
      section.classList.toggle("on", id === activePage);
    }

  });


  [...nav.children].forEach((button) => {

    button.setAttribute(
      "aria-selected",
      button.dataset.k === activePage ? "true" : "false"
    );

  });


  window.history.replaceState(null, "", "#" + activePage);

}


TABS.forEach(([key, title]) => {

  const button = document.createElement("button");

  button.type = "button";
  button.textContent = title;
  button.dataset.k = key;

  button.setAttribute("aria-controls", "v-" + key);
  button.setAttribute("aria-selected", "false");


  button.addEventListener("click", () => {

    go(key);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  });


  nav.appendChild(button);

});


const initialPage = window.location.hash.slice(1);

go(initialPage);


$("#brand-home").addEventListener("click", (event) => {

  event.preventDefault();

  go("home");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});


/* Start daily mood check-in */

$("#start-checkin").addEventListener("click", () => {

  go("today");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});


/* Date */

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

$("#date-label").textContent = dateFormatter.format(new Date());


/* =========================================================
   3. OVERVIEW
   ========================================================= */

const workflow = [

  [
    "1 DATA",
    "Behavioural and wearable information is audited and prepared."
  ],

  [
    "2 MODEL",
    "Machine learning estimates the risk of an elevated PHQ-9 score."
  ],

  [
    "3 EXPLAIN",
    "Explainable AI helps interpret factors behind model estimates."
  ],

  [
    "4 SUPPORT",
    "Different support suggestions are presented for different risk levels."
  ],

  [
    "5 SAATHI",
    "A multilingual AI companion provides supportive conversations."
  ]

];


$("#flow").innerHTML = workflow.map(([step, description]) => `

  <li>
    <b>${escapeHTML(step)}</b>
    ${escapeHTML(description)}
  </li>

`).join("");


async function loadOverview() {

  const container = $("#kpis");
  const note = $("#honest");


  try {

    const data = await api("/api/risk");


    if (!data.ready || !data.metrics || !data.metrics.test) {

      container.innerHTML = `
        <div class="card">
          Model evaluation results are not available.
        </div>
      `;

      return;

    }


    const test = data.metrics.test;


    const metrics = [

      [
        Number(test.roc_auc).toFixed(3),
        "ROC-AUC on held-out participants"
      ],

      [
        Number(test.pr_auc).toFixed(3),
        "Precision-recall AUC"
      ],

      [
        Number(test.brier).toFixed(3),
        "Brier score (lower is better)"
      ],

      [
        Number(test.n_rows).toLocaleString("en-IN"),
        "Test participant-period rows"
      ]

    ];


    container.innerHTML = metrics.map(([value, label]) => `

      <div class="card kpi">

        <b>${escapeHTML(value)}</b>

        <span>${escapeHTML(label)}</span>

      </div>

    `).join("");


    const baseline = Number(test.baseline_start_score_only_auc);
    const model = Number(test.roc_auc);


    note.innerHTML = `

      <strong>How to interpret these results:</strong>

      The selected model achieved a test ROC-AUC of

      <strong>${escapeHTML(model.toFixed(3))}</strong>,

      compared with

      <strong>${escapeHTML(baseline.toFixed(3))}</strong>

      for the starting PHQ-9-only baseline.

      The selected model combines behavioural/context features
      with the starting PHQ-9 score.

      Behaviour-only performance is weaker.

      These are research evaluation results,
      not clinical validation.

    `;


    renderInsights(data);


  } catch (error) {

    container.innerHTML = `
      <div class="card">
        Could not load model results.
        Please check the Flask server.
      </div>
    `;

    note.textContent = error.message;

  }

}


loadOverview();


/* =========================================================
   4. TODAY — MOOD AND LONELINESS CHECK-IN
   ========================================================= */

let selectedMood = 0;
let selectedLoneliness = 0;


function createRatingScale(selector, callback) {

  const container = $(selector);

  container.innerHTML = "";


  for (let value = 1; value <= 5; value++) {

    const button = document.createElement("button");

    button.type = "button";
    button.textContent = value;

    button.setAttribute("aria-pressed", "false");


    button.addEventListener("click", () => {

      [...container.children].forEach((item) => {
        item.setAttribute("aria-pressed", "false");
      });

      button.setAttribute("aria-pressed", "true");

      callback(value);

    });


    container.appendChild(button);

  }

}


createRatingScale("#mood", (value) => {

  selectedMood = value;

});


createRatingScale("#lonely", (value) => {

  selectedLoneliness = value;

});


/* Greeting */

const hour = new Date().getHours();

if (hour < 12) {

  $("#greet").textContent =
    "Good morning. Take a moment for yourself today.";

} else if (hour < 17) {

  $("#greet").textContent =
    "Good afternoon. How are you feeling today?";

} else {

  $("#greet").textContent =
    "Good evening. Take a gentle moment to reflect.";

}


/* Load mood chart */

function renderChart(data) {

  const chart = $("#chart");
  const nudge = $("#nudge");

  const entries = Array.isArray(data.entries)
    ? data.entries
    : [];


  if (entries.length === 0) {

    chart.innerHTML = `

      <p class="empty-state">
        No check-ins yet. Save your first check-in to begin.
      </p>

    `;

    nudge.textContent =
      "Your personal trend will appear after you add a few check-ins.";

    return;

  }


  const width = 340;
  const height = 150;

  const left = 20;
  const right = 320;

  const top = 15;
  const bottom = 125;


  const x = (index) => {

    if (entries.length === 1) {
      return (left + right) / 2;
    }

    return left +
      index * (right - left) / (entries.length - 1);

  };


  const y = (value) => {

    return bottom -
      ((value - 1) / 4) * (bottom - top);

  };


  const createPath = (key) => {

    return entries.map((entry, index) => {

      const command = index === 0 ? "M" : "L";

      return `${command}${x(index)} ${y(entry[key])}`;

    }).join(" ");

  };


  const moodPath = createPath("mood");
  const lonelinessPath = createPath("loneliness");


  const gridLines = [1, 2, 3, 4, 5].map((value) => `

    <line
      x1="${left}"
      y1="${y(value)}"
      x2="${right}"
      y2="${y(value)}"
      stroke="#E8EDE6"
      stroke-width="1"
      stroke-dasharray="3 4"
    />

  `).join("");


  const moodPoints = entries.map((entry, index) => `

    <circle
      cx="${x(index)}"
      cy="${y(entry.mood)}"
      r="3.5"
      fill="#397D70"
    />

  `).join("");


  const lonelinessPoints = entries.map((entry, index) => `

    <circle
      cx="${x(index)}"
      cy="${y(entry.loneliness)}"
      r="3.5"
      fill="#E8B96A"
    />

  `).join("");


  chart.innerHTML = `

    <svg
      viewBox="0 0 ${width} ${height}"
      width="100%"
      role="img"
      aria-label="Mood and loneliness over recent check-ins"
    >

      ${gridLines}

      <path
        d="${moodPath}"
        fill="none"
        stroke="#397D70"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <path
        d="${lonelinessPath}"
        fill="none"
        stroke="#E8B96A"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      ${moodPoints}

      ${lonelinessPoints}

    </svg>

  `;


  const trend = data.trend || {};


  if (trend.nudge === "down") {

    nudge.textContent =
      "Your recent check-ins differ from your earlier pattern. Consider talking with Saathi or someone you trust.";

  } else if (trend.nudge === "up") {

    nudge.textContent =
      "Your recent check-ins look more positive than your earlier pattern. Notice the small things that are helping.";

  } else {

    nudge.textContent =
      "Keep checking in gently. Trends are compared with your own earlier check-ins.";

  }

}


async function loadCheckins() {

  try {

    const data = await api("/api/checkins");

    renderChart(data);

  } catch (error) {

    $("#chart").textContent = "Could not load check-ins.";

  }

}


loadCheckins();


/* Save mood check-in */

$("#save").addEventListener("click", async () => {

  const feedback = $("#saved");
  const button = $("#save");


  if (!selectedMood || !selectedLoneliness) {

    feedback.textContent = "Please select both ratings first.";

    return;

  }


  button.disabled = true;
  feedback.textContent = "Saving…";


  try {

    const data = await api(
      "/api/checkins",

      jsonOptions({
        mood: selectedMood,
        loneliness: selectedLoneliness
      })

    );


    renderChart(data);

    feedback.textContent = "Your check-in has been saved.";

  } catch (error) {

    feedback.textContent = error.message;

  } finally {

    button.disabled = false;

  }

});


/* =========================================================
   5. PHQ-9 ASSESSMENT
   ========================================================= */

/*
  IMPORTANT:

  PHQ-9 is a screening questionnaire.

  These responses are held in JavaScript memory only.
  They are NOT sent to the Flask backend.
  They are NOT saved in SQLite.
  They are NOT used as XGBoost predictions.
*/


const PHQ_OPTIONS = [

  {
    value: 0,
    label: "Not at all"
  },

  {
    value: 1,
    label: "Several days"
  },

  {
    value: 2,
    label: "More than half the days"
  },

  {
    value: 3,
    label: "Nearly every day"
  }

];


const PHQ_QUESTIONS = [

  {
    text: "Little interest or pleasure in doing things.",
    category: "Interest and enjoyment"
  },

  {
    text: "Feeling down, depressed, or hopeless.",
    category: "Mood"
  },

  {
    text: "Trouble falling or staying asleep, or sleeping too much.",
    category: "Sleep"
  },

  {
    text: "Feeling tired or having little energy.",
    category: "Energy"
  },

  {
    text: "Poor appetite or overeating.",
    category: "Appetite"
  },

  {
    text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down.",
    category: "Self-worth"
  },

  {
    text: "Trouble concentrating on things, such as reading the newspaper or watching television.",
    category: "Concentration"
  },

  {
    text: "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual.",
    category: "Movement and restlessness"
  },

  {
    text: "Thoughts that you would be better off dead, or of hurting yourself in some way?",
    category: "Safety and wellbeing"
  }

];


/* Current assessment state */

let phqCurrentQuestion = 0;

let phqAnswers = Array(9).fill(null);


/* Severity interpretation */

function getPhqSeverity(score) {

  if (score <= 4) {

    return {

      label: "Minimal range",

      message:
        "Your responses fall within the minimal symptom range. If you are still concerned about how you feel, it is okay to speak with a healthcare professional."

    };

  }


  if (score <= 9) {

    return {

      label: "Mild range",

      message:
        "Your responses fall within the mild symptom range. Consider noticing how you feel over time and reaching out to a professional if symptoms persist or affect daily life."

    };

  }


  if (score <= 14) {

    return {

      label: "Moderate range",

      message:
        "Your responses fall within the moderate symptom range. It would be helpful to discuss these experiences with a qualified healthcare professional."

    };

  }


  if (score <= 19) {

    return {

      label: "Moderately severe range",

      message:
        "Your responses fall within the moderately severe symptom range. Please arrange a conversation with a qualified healthcare professional soon."

    };

  }


  return {

    label: "Severe range",

    message:
      "Your responses fall within the severe symptom range. Please seek support from a qualified healthcare professional promptly. You do not have to manage this alone."

  };

}

/* =========================================================
   PHQ-9 — PERSONALIZED RECOMMENDATIONS
   Supportive guidance, not diagnosis or treatment.
   ========================================================= */

function getPhqRecommendations(score, answers) {

  let guidance;

  /* SCORE-BASED GUIDANCE */

  if (score <= 4) {

    guidance = {
      title: "Keep supporting your wellbeing",

      description:
        "Your responses fall within the minimal symptom range. Continue making space for rest, connection and activities that matter to you.",

      actions: [
        {
          title: "Maintain a gentle routine",
          text: "Try to keep regular sleep and meal times while making room for rest."
        },
        {
          title: "Stay connected",
          text: "Make time for a friend, family member or someone you feel comfortable with."
        },
        {
          title: "Make time for yourself",
          text: "Continue an activity you enjoy, even if it is something small."
        }
      ],

      followup:
        "Keep noticing how you feel. Speak with a healthcare professional if symptoms appear, persist or begin affecting your daily life."
    };

  } else if (score <= 9) {

    guidance = {
      title: "Try a few gentle, manageable steps",

      description:
        "Your responses fall within the mild symptom range. Small changes and supportive conversations may be useful while you monitor how you feel.",

      actions: [
        {
          title: "Choose one small activity",
          text: "Try a short walk, a favourite hobby or another manageable activity instead of taking on too much at once."
        },
        {
          title: "Keep a daily rhythm",
          text: "Try to maintain a consistent wake-up time and regular meals."
        },
        {
          title: "Talk to someone",
          text: "Share how you have been feeling with someone you trust. You do not have to handle everything alone."
        }
      ],

      followup:
        "Notice whether your symptoms are improving or getting worse. Consider a follow-up around one month, and contact a healthcare professional sooner if symptoms persist, worsen or affect daily life."
    };

  } else if (score <= 14) {

    guidance = {
      title: "Consider getting some extra support",

      description:
        "Your responses fall within the moderate symptom range. It would be helpful to discuss these experiences with a qualified healthcare professional.",

      actions: [
        {
          title: "Arrange a professional conversation",
          text: "Consider booking an appointment with a doctor, counsellor or qualified mental health professional to discuss your responses."
        },
        {
          title: "Share what you are experiencing",
          text: "Tell someone you trust about how you have been feeling and let them know what kind of support would help."
        },
        {
          title: "Make everyday tasks manageable",
          text: "Break responsibilities into small steps and allow yourself reasonable breaks."
        }
      ],

      followup:
        "Please arrange a conversation with a healthcare professional rather than relying on self-help suggestions alone."
    };

  } else if (score <= 19) {

    guidance = {
      title: "Please arrange professional support soon",

      description:
        "Your responses fall within the moderately severe symptom range. These experiences deserve attention and support from a qualified professional.",

      actions: [
        {
          title: "Prioritise an appointment",
          text: "Please contact a doctor or qualified mental health professional to discuss your symptoms and possible next steps."
        },
        {
          title: "Reach out to someone you trust",
          text: "Consider telling a trusted person how things have been feeling and asking them to support you in accessing care."
        },
        {
          title: "Reduce unnecessary pressure",
          text: "Focus on essential tasks and allow yourself support with everyday responsibilities."
        }
      ],

      followup:
        "Please do not postpone seeking professional guidance. A qualified professional can assess your situation and discuss appropriate care."
    };

  } else {

    guidance = {
      title: "Please seek professional support promptly",

      description:
        "Your responses fall within the severe symptom range. It is important to speak with a qualified healthcare professional promptly.",

      actions: [
        {
          title: "Contact a healthcare professional",
          text: "Please arrange a prompt appointment with a doctor or mental health professional to discuss your responses."
        },
        {
          title: "Ask someone to support you",
          text: "Reach out to a trusted person who can listen and help you connect with professional care."
        },
        {
          title: "Focus on immediate needs",
          text: "Keep things manageable and ask for help with everyday responsibilities while arranging support."
        }
      ],

      followup:
        "Your score does not establish a diagnosis. A qualified professional should review your experiences and help determine the appropriate next steps."
    };

  }


  /* RESPONSE-BASED SUGGESTIONS */

  const personalized = [];


  /* Question 1 — Interest and enjoyment */

  if (answers[0] >= 2) {

    personalized.push({
      title: "Make room for one enjoyable moment",

      text:
        "You reported reduced interest or pleasure. Consider choosing one small activity you used to enjoy, without putting pressure on yourself to feel a certain way."
    });

  }


  /* Question 2 — Mood */

  if (answers[1] >= 2) {

    personalized.push({
      title: "Share how you have been feeling",

      text:
        "You reported feeling down or hopeless frequently. Consider speaking openly with someone you trust or a mental health professional."
    });

  }


  /* Question 3 — Sleep */

  if (answers[2] >= 2) {

    personalized.push({
      title: "Give your sleep routine some attention",

      text:
        "You reported frequent sleep difficulties. A consistent wake-up time and a calmer wind-down routine may help support better sleep."
    });

  }


  /* Question 4 — Energy */

  if (answers[3] >= 2) {

    personalized.push({
      title: "Make tasks smaller",

      text:
        "You reported low energy frequently. Try breaking a task into smaller steps and allowing yourself breaks instead of trying to complete everything at once."
    });

  }


  /* Question 5 — Appetite */

  if (answers[4] >= 2) {

    personalized.push({
      title: "Notice changes in your eating routine",

      text:
        "You reported appetite changes. Try maintaining regular meals where possible. Discuss persistent or concerning changes with a healthcare professional."
    });

  }


  /* Question 6 — Self-worth */

  if (answers[5] >= 2) {

    personalized.push({
      title: "Be kinder to yourself",

      text:
        "You reported frequent negative feelings about yourself. Consider sharing these thoughts with someone supportive or a qualified counsellor."
    });

  }


  /* Question 7 — Concentration */

  if (answers[6] >= 2) {

    personalized.push({
      title: "Reduce distractions and focus on one thing",

      text:
        "You reported concentration difficulties. Try working on one small task at a time, taking short breaks and reducing unnecessary distractions."
    });

  }


  /* Question 8 — Movement and restlessness */

  if (answers[7] >= 2) {

    personalized.push({
      title: "Talk about changes in your activity or restlessness",

      text:
        "You reported frequent restlessness or noticeable slowing down. Discuss these experiences with a healthcare professional, especially if they affect daily activities."
    });

  }


  /* Item 9 — Safety priority */

  const item9Positive = answers[8] > 0;


  return {
    ...guidance,
    personalized,
    item9Positive
  };

}


/* Render recommendation cards */

function renderPhqRecommendations(score, answers) {

  const result = getPhqRecommendations(score, answers);

  const container = $("#phq-recommendation-list");

  const followup = $("#phq-followup");


  const allActions = [
    ...result.actions,
    ...result.personalized
  ];


  container.innerHTML = `

    <div class="phq-guidance-intro">

      <span class="phq-guidance-symbol" aria-hidden="true">✦</span>

      <div>

        <h3>${escapeHTML(result.title)}</h3>

        <p>${escapeHTML(result.description)}</p>

      </div>

    </div>


    <div class="phq-recommendation-cards">

      ${allActions.map((action, index) => `

        <article class="phq-tip-card">

          <span class="phq-tip-number">
            ${String(index + 1).padStart(2, "0")}
          </span>

          <div>

            <h3>${escapeHTML(action.title)}</h3>

            <p>${escapeHTML(action.text)}</p>

          </div>

        </article>

      `).join("")}

    </div>

  `;


  followup.innerHTML = `

    <strong>What next?</strong>

    <p>${escapeHTML(result.followup)}</p>

  `;


  /*
    Item 9 is handled separately.

    A positive response does not automatically establish
    immediate danger. It requires timely follow-up by
    a competent human professional.
  */

  if (result.item9Positive) {

    followup.innerHTML = `

      <strong>Safety comes first.</strong>

      <p>
        Because you selected an answer other than
        "Not at all" for question 9, please seek a
        timely conversation with a qualified professional
        who can ask further safety questions.
        Consider reaching out to someone you trust now.
      </p>

      <p>
        Tele-MANAS India:
        <a href="tel:14416">14416</a>
        (free, 24/7).
        If you are in immediate danger, call
        <a href="tel:112">112</a>.
      </p>

    `;

  }

}


/* Render one question */

function renderPhqQuestion() {

  const question = PHQ_QUESTIONS[phqCurrentQuestion];

  const questionNumber = phqCurrentQuestion + 1;

  const selectedAnswer = phqAnswers[phqCurrentQuestion];


  const progress = Math.round(
    (questionNumber / PHQ_QUESTIONS.length) * 100
  );


  $("#phq-step-label").textContent =
    `Question ${questionNumber} of 9`;


  $("#phq-progress-percent").textContent =
    progress + "%";


  $("#phq-progress-fill").style.width =
    progress + "%";


  const progressBar = $("#phq-progress-bar");

  progressBar.setAttribute(
    "aria-valuenow",
    questionNumber
  );


  $("#phq-error").textContent = "";


  $("#phq-question").innerHTML = `

    <div class="phq-question-meta">

      <span class="question-number">
        ${String(questionNumber).padStart(2, "0")}
      </span>

      <span>
        ${escapeHTML(question.category)}
      </span>

    </div>


    <h2 class="phq-question-text">
      ${escapeHTML(question.text)}
    </h2>


    <p class="phq-question-hint">
      Over the last 2 weeks, how often have you been bothered by this?
    </p>


    <div class="phq-options" role="group" aria-label="Select your response">

      ${PHQ_OPTIONS.map((option) => `

        <button
          class="phq-option ${selectedAnswer === option.value ? "selected" : ""}"
          type="button"
          data-answer="${option.value}"
          aria-pressed="${selectedAnswer === option.value}"
        >

          <span class="phq-option-value">
            ${option.value}
          </span>

          <span class="phq-option-label">
            ${escapeHTML(option.label)}
          </span>

          <span class="phq-option-check" aria-hidden="true">
            ${selectedAnswer === option.value ? "✓" : ""}
          </span>

        </button>

      `).join("")}

    </div>

  `;


  /* Answer selection */

  document.querySelectorAll(".phq-option").forEach((button) => {

    button.addEventListener("click", () => {

      const answer = Number(button.dataset.answer);

      phqAnswers[phqCurrentQuestion] = answer;

      document.querySelectorAll(".phq-option").forEach((item) => {

        const selected =
          Number(item.dataset.answer) === answer;

        item.classList.toggle("selected", selected);

        item.setAttribute(
          "aria-pressed",
          selected ? "true" : "false"
        );

        item.querySelector(".phq-option-check").textContent =
          selected ? "✓" : "";

      });


      updatePhqNavigation();

    });

  });


  updatePhqNavigation();

}


/* Navigation controls */

function updatePhqNavigation() {

  const isFirst = phqCurrentQuestion === 0;

  const isLast = phqCurrentQuestion === 8;

  const hasAnswer = phqAnswers[phqCurrentQuestion] !== null;


  $("#phq-previous").disabled = isFirst;


  $("#phq-next").hidden = isLast;

  $("#phq-submit").hidden = !isLast;


  $("#phq-next").disabled = !hasAnswer;

  $("#phq-submit").disabled = !hasAnswer;

}


$("#phq-next").addEventListener("click", () => {

  if (phqAnswers[phqCurrentQuestion] === null) {

    $("#phq-error").textContent =
      "Please select an answer before continuing.";

    return;

  }


  if (phqCurrentQuestion < 8) {

    phqCurrentQuestion++;

    renderPhqQuestion();

  }

});


$("#phq-previous").addEventListener("click", () => {

  if (phqCurrentQuestion > 0) {

    phqCurrentQuestion--;

    renderPhqQuestion();

  }

});


/* Calculate result */


function submitPhqAssessment() {

  const unanswered = phqAnswers.some(
    (answer) => answer === null
  );


  if (unanswered) {

    $("#phq-error").textContent =
      "Please answer all nine questions before viewing your result.";

    return;

  }


  /* Total score: 0 to 27 */

  const totalScore = phqAnswers.reduce(
    (total, answer) => total + answer,
    0
  );


  /* Question 9 safety response */

  const item9Positive = phqAnswers[8] > 0;


  const severity = getPhqSeverity(totalScore);


  /* Display score */

  $("#phq-score").textContent = totalScore;

  $("#phq-severity").textContent = severity.label;

  $("#phq-score-message").textContent = severity.message;


  /* Display safety panel */

  $("#phq-safety-panel").hidden = !item9Positive;


  /* Update safety text */

  if (item9Positive) {

    $("#phq-safety-panel").querySelector("p").textContent =

      "You indicated that thoughts about being better off dead or hurting yourself have occurred. This response alone does not tell us whether you are in immediate danger. Please reach out to a trusted person and seek timely professional support.";

  }


  /* Generate personalized recommendations */

  renderPhqRecommendations(
    totalScore,
    phqAnswers
  );


  /* Switch to results */

  $("#phq-form").hidden = true;

  $("#phq-result").hidden = false;


  /* Bring result into view */

  $("#phq-result").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


$("#phq-submit").addEventListener(
  "click",
  submitPhqAssessment
);


/* Start or restart an assessment */

function startNewPhqAssessment() {

  phqCurrentQuestion = 0;

  phqAnswers = Array(9).fill(null);


  $("#phq-form").hidden = false;

  $("#phq-result").hidden = true;


  $("#phq-score").textContent = "0";

  $("#phq-severity").textContent = "Not calculated";

  $("#phq-score-message").textContent =
    "Your result will appear here.";


  $("#phq-safety-panel").hidden = true;

  $("#phq-error").textContent = "";


  renderPhqQuestion();

}


$("#phq-retake").addEventListener(
  "click",
  startNewPhqAssessment
);


$("#phq-done").addEventListener("click", () => {

  go("home");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

});


/* Initialise questionnaire */

startNewPhqAssessment();


/* =========================================================
   6. SAATHI — AI COMPANION
   ========================================================= */

const chatLog = $("#log");

const chatHistory = [];


let speechLanguage = "en-IN";

let isSending = false;


/* Add message bubble */

function addBubble(type, message) {

  const bubble = document.createElement("div");

  bubble.className = "m " + type;

  bubble.textContent = message;

  chatLog.appendChild(bubble);

  chatLog.scrollTop = chatLog.scrollHeight;

  return bubble;

}


/* Initial greeting */

function welcomeSaathi() {

  addBubble(
    "bot",
    "Hello, I'm Saathi. This is a space where you can share what is on your mind. How has your day been?"
  );

}


welcomeSaathi();


/* Suggested prompts */

const prompts = [

  "I feel lonely today",

  "I could not sleep well",

  "Mujhe thoda udaas lag raha hai",

  "I just want to talk"

];


prompts.forEach((prompt) => {

  const button = document.createElement("button");

  button.type = "button";

  button.textContent = prompt;


  button.addEventListener("click", () => {

    $("#msg").value = prompt;

    sendMessage();

  });


  $("#chips").appendChild(button);

});


/* Text to speech */

function speakReply(message) {

  if (!$("#speak").checked) return;

  if (!window.speechSynthesis) return;


  window.speechSynthesis.cancel();


  const utterance = new SpeechSynthesisUtterance(message);

  utterance.lang = speechLanguage;

  utterance.rate = 0.95;


  window.speechSynthesis.speak(utterance);

}


/* Crisis support card */

function addCrisisCard(helplines) {

  const card = document.createElement("div");

  card.className = "m crisis";


  const title = document.createElement("strong");

  title.textContent = "Immediate support";

  card.appendChild(title);


  const number = Array.isArray(helplines.numbers)
    ? helplines.numbers[0]
    : null;


  if (number) {

    const p = document.createElement("p");

    p.textContent = helplines.name + ": ";

    const link = document.createElement("a");

    link.href = "tel:" + number;

    link.textContent = number;

    p.appendChild(link);

    card.appendChild(p);

  }


  if (helplines.emergency) {

    const p = document.createElement("p");

    p.textContent = "Emergency services: ";

    const link = document.createElement("a");

    link.href = "tel:" + helplines.emergency;

    link.textContent = helplines.emergency;

    p.appendChild(link);

    card.appendChild(p);

  }


  chatLog.appendChild(card);

  chatLog.scrollTop = chatLog.scrollHeight;

}


/* Send chat message */

async function sendMessage() {

  const input = $("#msg");

  const message = input.value.trim();


  if (!message || isSending) return;


  isSending = true;

  $("#send").disabled = true;


  addBubble("me", message);

  input.value = "";


  const waiting = addBubble(
    "bot",
    "Saathi is listening…"
  );


  try {

    const response = await api(
      "/api/chat",

      jsonOptions({

        message: message,

        history: chatHistory.slice(-10)

      })

    );


    waiting.remove();


    if (response.error) {

      addBubble("bot", response.error);

      return;

    }


    const replyType = response.level === "crisis"
      ? "crisis"
      : "bot";


    addBubble(replyType, response.reply);


    if (
      response.level === "crisis" &&
      response.helplines
    ) {

      addCrisisCard(response.helplines);

    }


    /* In-memory chat history */

    chatHistory.push(

      {
        role: "user",
        text: message
      },

      {
        role: "bot",
        text: response.reply
      }

    );


    speechLanguage =
      response.lang === "hi" ||
      response.lang === "hinglish"
        ? "hi-IN"
        : "en-IN";


    speakReply(response.reply);


  } catch (error) {

    waiting.remove();

    addBubble(
      "bot",
      "I could not reach the server. Please check your connection and try again."
    );

    console.error(error);

  } finally {

    isSending = false;

    $("#send").disabled = false;

    input.focus();

  }

}


$("#send").addEventListener("click", sendMessage);


$("#msg").addEventListener("keydown", (event) => {

  if (event.key === "Enter") {

    event.preventDefault();

    sendMessage();

  }

});


/* Clear conversation */

$("#clear-chat").addEventListener("click", () => {

  chatHistory.length = 0;

  chatLog.innerHTML = "";


  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }


  welcomeSaathi();

});


/* Speech recognition */

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


if (SpeechRecognition) {

  const micButton = $("#mic");

  micButton.hidden = false;


  micButton.addEventListener("click", () => {

    const recognition = new SpeechRecognition();

    recognition.lang = speechLanguage;

    recognition.continuous = false;

    recognition.interimResults = false;


    recognition.onstart = () => {

      micButton.classList.add("is-listening");

      micButton.title = "Listening…";

    };


    recognition.onresult = (event) => {

      $("#msg").value =
        event.results[0][0].transcript;

      sendMessage();

    };


    recognition.onerror = () => {

      addBubble(
        "bot",
        "I could not recognise your voice. You can type your message instead."
      );

    };


    recognition.onend = () => {

      micButton.classList.remove("is-listening");

      micButton.title = "Speak";

    };


    try {

      recognition.start();

    } catch (error) {

      console.error("Speech recognition error:", error);

    }

  });

} else {

  $("#mic").hidden = true;

}


/* =========================================================
   7. RISK INSIGHTS
   ========================================================= */

const LEVEL_NAMES = {

  low: "Low",

  moderate: "Moderate",

  high: "High"

};


function renderInsights(data) {

  const container = $("#insights");

  const users = Array.isArray(data.users)
    ? data.users
    : [];


  if (users.length === 0) {

    container.innerHTML = `
      <div class="card">
        No research examples are currently available.
      </div>
    `;

    return;

  }


  const thresholds = data.thresholds || {};

  const moderate = Number(thresholds.moderate || 0.2727) * 100;

  const high = Number(thresholds.high || 0.4227) * 100;


  const cards = users.map((user) => {

    const probability = Number(user.probability) * 100;

    const level = LEVEL_NAMES[user.level] || "Unknown";

    const factors = Array.isArray(user.factors)
      ? user.factors
      : [];


    const support = (
      data.support && data.support[user.level]
    ) || {
      title: "Consider speaking with someone you trust.",
      actions: []
    };


    const largest = Math.max(
      ...factors.map((factor) => Number(factor.size) || 0),
      0.001
    );


    const factorHTML = factors.map((factor) => {

      const size = Number(factor.size) || 0;

      const barWidth = Math.max(
        8,
        (size / largest) * 100
      );


      const direction = factor.direction === "raises"
        ? "raises"
        : "lowers";


      return `

        <div class="f">

          <span>

            ${escapeHTML(factor.name)}

            <br>

            <span class="mute">
              ${escapeHTML(direction)} the estimate
            </span>

          </span>


          <div>

            <s
              class="${direction === "lowers" ? "dn" : ""}"
              style="width:${barWidth.toFixed(1)}%"
            ></s>

          </div>

        </div>

      `;

    }).join("");


    const actions = Array.isArray(support.actions)
      ? support.actions
      : [];


    const actionHTML = actions.map((action) => `
      <li>${escapeHTML(action)}</li>
    `).join("");


    return `

      <article class="card">


        <div class="uh">

          <b>${escapeHTML(user.label || "Demo participant")}</b>

          <span class="pill ${escapeHTML(user.level)}">
            ${escapeHTML(level)} risk
          </span>

        </div>


        <p class="card-description">

          Estimated chance of a PHQ-9 score of 10 or more:

          <strong>${probability.toFixed(1)}%</strong>

        </p>


        <div
          class="gauge"
          style="--m:${moderate}%;--h:${high}%"
        >

          <i
            style="left:${Math.min(99, Math.max(0, probability))}%"
          ></i>

        </div>


        <h3>Factors shown by the model</h3>


        ${factorHTML}


        <p>
          <strong>${escapeHTML(support.title)}</strong>
        </p>


        <ul class="act">
          ${actionHTML}
        </ul>


      </article>

    `;

  }).join("");


  container.innerHTML = cards;


  /* Fairness results */

  const fairness = data.metrics &&
    data.metrics.fairness_auc_by_group;


  if (fairness && typeof fairness === "object") {

    const rows = Object.entries(fairness).map(([group, value]) => {

      const auc = typeof value === "number"
        ? value
        : value && (value.roc_auc ?? value.auc);


      if (typeof auc !== "number") return "";


      return `

        <tr>

          <td>${escapeHTML(group)}</td>

          <td>${Number(auc).toFixed(3)}</td>

        </tr>

      `;

    }).join("");


    if (rows) {

      container.insertAdjacentHTML("beforeend", `

        <article class="card">

          <h3>Fairness: ROC-AUC by group</h3>

          <table>

            <thead>

              <tr>
                <th>Group</th>
                <th>ROC-AUC</th>
              </tr>

            </thead>

            <tbody>
              ${rows}
            </tbody>

          </table>


          <p class="mute">
            Small groups require cautious interpretation.
            These results do not establish clinical fairness.
          </p>

        </article>

      `);

    }

  }

}


/* =========================================================
   8. HELP NOW
   ========================================================= */

async function loadHelp() {

  const container = $("#helpbox");


  try {

    const help = await api("/api/helplines");


    const helplineCard = document.createElement("article");

    helplineCard.className = "card";


    helplineCard.innerHTML = `

      <h3>Immediate mental health support</h3>

      <p>
        <strong>${escapeHTML(help.name || "Mental health support")}</strong>
      </p>

    `;


    const number = Array.isArray(help.numbers)
      ? help.numbers[0]
      : null;


    if (number) {

      const p = document.createElement("p");

      const link = document.createElement("a");

      link.href = "tel:" + number;

      link.textContent = number;

      p.appendChild(link);

      helplineCard.appendChild(p);

    }


    if (help.note) {

      const note = document.createElement("p");

      note.textContent = help.note;

      helplineCard.appendChild(note);

    }


    const emergencyCard = document.createElement("article");

    emergencyCard.className = "card";

    emergencyCard.innerHTML = `

      <h3>Emergency support</h3>

      <p>
        If someone is in immediate danger, contact emergency services.
      </p>

    `;


    if (help.emergency) {

      const p = document.createElement("p");

      const link = document.createElement("a");

      link.href = "tel:" + help.emergency;

      link.textContent = help.emergency;

      p.appendChild(link);

      emergencyCard.appendChild(p);

    }


    const nextSteps = document.createElement("article");

    nextSteps.className = "card";

    nextSteps.innerHTML = `

      <h3>Small next steps</h3>

      <ol>

        <li>Reach out to someone you trust.</li>

        <li>Consider speaking with a counsellor or doctor.</li>

        <li>Seek urgent help if you are in immediate danger.</li>

      </ol>

    `;


    container.replaceChildren(
      helplineCard,
      emergencyCard,
      nextSteps
    );


  } catch (error) {

    container.innerHTML = `

      <div class="card">
        Support information could not be loaded.
        Please check the server connection.
      </div>

    `;

  }

}


loadHelp();


/* =========================================================
   9. PRIVACY — DELETE DATA
   ========================================================= */

$("#wipe").addEventListener("click", async () => {

  const feedback = $("#wiped");

  const button = $("#wipe");


  const confirmed = window.confirm(
    "Are you sure you want to delete all check-ins and saved settings from this app?"
  );


  if (!confirmed) return;


  button.disabled = true;

  feedback.textContent = "Deleting…";


  try {

    await api("/api/data", {
      method: "DELETE"
    });


    selectedMood = 0;

    selectedLoneliness = 0;


    [
      ...$("#mood").children,
      ...$("#lonely").children
    ].forEach((item) => {

      item.setAttribute("aria-pressed", "false");

    });


    await loadCheckins();


    feedback.textContent =
      "Your app data has been deleted.";


  } catch (error) {

    feedback.textContent = error.message;

  } finally {

    button.disabled = false;

  }

});


/* =========================================================
   10. APP INITIALISED
   ========================================================= */

console.log("MindSathi AI frontend initialized.");
console.log("PHQ-9 assessment module initialized.");
