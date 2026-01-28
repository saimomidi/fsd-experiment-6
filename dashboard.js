document.addEventListener("DOMContentLoaded", () => {
  const predictionForm = document.getElementById("predictionForm");
  const resultDiv = document.getElementById("predictionResult");
  const clearHistoryBtn = document.getElementById("clearHistory");

  let charts = {};

  /* ================== PREDICTION ================== */
  predictionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const features = [
      parseFloat(document.getElementById("sepal_length").value),
      parseFloat(document.getElementById("sepal_width").value),
      parseFloat(document.getElementById("petal_length").value),
      parseFloat(document.getElementById("petal_width").value),
    ];

    const model = document.getElementById("model").value;

    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features, model }),
    });

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
            <h3>Prediction Result</h3>
            <p><strong>Predicted Class:</strong> ${data.prediction}</p>
            <p><strong>Confidence:</strong> ${(data.confidence * 100).toFixed(2)}%</p>
        `;

    loadDashboardStats();
  });

  /* ================== CLEAR HISTORY ================== */
  clearHistoryBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear prediction history?")) return;

    const response = await fetch("/api/clear-history", { method: "POST" });
    const data = await response.json();

    if (data.success) {
      alert(`Deleted ${data.deleted_count} records`);
      loadDashboardStats();
    }
  });

  /* ================== LOAD STATS ================== */
  async function loadDashboardStats() {
    const response = await fetch("/api/stats");
    const stats = await response.json();

    document.getElementById("totalPredictions").innerText =
      stats.total_predictions;

    // Avg confidence
    let avgConfidence = 0;
    if (stats.avg_confidence_by_model.length > 0) {
      avgConfidence =
        stats.avg_confidence_by_model.reduce(
          (sum, m) => sum + m.avg_confidence,
          0,
        ) / stats.avg_confidence_by_model.length;
    }
    document.getElementById("avgConfidence").innerText =
      (avgConfidence * 100).toFixed(1) + "%";

    document.getElementById("modelsUsed").innerText =
      stats.predictions_by_model.length;

    document.getElementById("topPrediction").innerText =
      stats.predictions_by_class.length > 0
        ? stats.predictions_by_class.sort((a, b) => b.count - a.count)[0]._id
        : "-";

    updateCharts(stats);
    updateRecentPredictions(stats.recent_predictions);
  }

  /* ================== CHARTS ================== */
  function updateCharts(stats) {
    renderChart(
      "predictionsByClass",
      "bar",
      stats.predictions_by_class.map((x) => x._id),
      stats.predictions_by_class.map((x) => x.count),
      "Predictions by Species",
    );

    renderChart(
      "predictionsByModel",
      "pie",
      stats.predictions_by_model.map((x) => x._id),
      stats.predictions_by_model.map((x) => x.count),
      "Predictions by Model",
    );

    renderChart(
      "confidenceDistribution",
      "doughnut",
      stats.confidence_distribution.map((x) => x._id),
      stats.confidence_distribution.map((x) => x.count),
      "Confidence Distribution",
    );

    renderChart(
      "modelComparison",
      "bar",
      stats.avg_confidence_by_model.map((x) => x._id),
      stats.avg_confidence_by_model.map((x) =>
        (x.avg_confidence * 100).toFixed(1),
      ),
      "Avg Confidence (%)",
    );
  }

  function renderChart(canvasId, type, labels, data, label) {
    const ctx = document.getElementById(canvasId).getContext("2d");

    if (charts[canvasId]) {
      charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: [
              "#667eea",
              "#764ba2",
              "#4fd1c5",
              "#f6ad55",
              "#fc8181",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: type !== "bar" },
        },
      },
    });
  }

  /* ================== RECENT PREDICTIONS ================== */
  function updateRecentPredictions(predictions) {
    const tbody = document.querySelector("#recentTable tbody");
    tbody.innerHTML = "";

    predictions.forEach((p) => {
      const row = document.createElement("tr");

      row.innerHTML = `
                <td>${new Date(p.timestamp.$date).toLocaleString()}</td>
                <td>${p.model}</td>
                <td>${p.prediction}</td>
                <td>${(p.confidence * 100).toFixed(2)}%</td>
            `;

      tbody.appendChild(row);
    });
  }

  /* ================== INIT ================== */
  loadDashboardStats();
});
