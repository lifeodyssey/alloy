<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>QA Report — {{taskId}} — {{ts}}</title>
<link rel="stylesheet" href="report.css">
</head>
<body>
<header class="report-header">
  <h1>QA Report</h1>
  <div class="report-meta">
    <span class="task-id">{{taskId}}</span>
    <span class="timestamp">{{ts}}</span>
    <span class="profile">Profile: {{profile}}</span>
  </div>
  <div class="health-summary">
    <span class="health-score baseline">{{healthBaseline}}</span>
    <span class="arrow">→</span>
    <span class="health-score final {{healthClass}}">{{healthFinal}}</span>
    <span class="delta {{deltaClass}}">{{healthDelta}}</span>
  </div>
</header>

<section class="health-table">
  <h2>Health Score</h2>
  <table>
    <thead><tr><th>Category</th><th>Baseline</th><th>Final</th><th>Delta</th></tr></thead>
    <tbody>{{#each categories}}
    <tr>
      <td>{{name}}</td>
      <td>{{baseline}}</td>
      <td>{{final}}</td>
      <td class="{{deltaClass}}">{{delta}}</td>
    </tr>{{/each}}
    <tr class="total-row">
      <td><strong>Overall</strong></td>
      <td><strong>{{healthBaseline}}</strong></td>
      <td><strong>{{healthFinal}}</strong></td>
      <td class="{{deltaClass}}"><strong>{{healthDelta}}</strong></td>
    </tr>
    </tbody>
  </table>
</section>

<section class="cases-matrix">
  <h2>Test Cases ({{caseCount}} total)</h2>
  <table>
    <thead><tr><th>ID</th><th>Title</th><th>Kind</th><th>Status</th><th>Duration</th><th>Evidence</th></tr></thead>
    <tbody>{{#each cases}}
    <tr class="case-{{status}}">
      <td class="case-id">{{id}}</td>
      <td>{{title}}</td>
      <td class="kind-badge kind-{{kind}}">{{kind}}</td>
      <td class="status-badge status-{{status}}">{{status}}</td>
      <td>{{duration}}s</td>
      <td class="evidence-links">{{#each screenshots}}<a href="{{this}}" target="_blank">📸</a>{{/each}}{{#if video}}<a href="{{video}}" target="_blank">🎬</a>{{/if}}{{#if trace}}<a href="{{trace}}" download>📦</a>{{/if}}</td>
    </tr>{{/each}}
    </tbody>
  </table>
</section>

<section class="issues-table">
  <h2>Issues ({{issueCount}} total)</h2>
  <table>
    <thead><tr><th>ID</th><th>Severity</th><th>Status</th><th>Commit</th></tr></thead>
    <tbody>{{#each issues}}
    <tr class="issue-{{severity}}">
      <td>{{id}}</td>
      <td class="severity-{{severity}}">{{severity}}</td>
      <td class="status-{{status}}">{{status}}</td>
      <td>{{commit}}</td>
    </tr>{{/each}}
    </tbody>
  </table>
</section>

<section class="screenshots-grid">
  <h2>Screenshots</h2>
  <div class="grid">{{#each allScreenshots}}
  <figure>
    <a href="{{src}}" target="_blank"><img src="{{src}}" alt="{{alt}}" loading="lazy"></a>
    <figcaption>{{alt}}</figcaption>
  </figure>{{/each}}
  </div>
</section>

{{#if hasVideos}}
<section class="videos">
  <h2>Videos</h2>
  {{#each videos}}
  <div class="video-wrapper">
    <p>{{label}}</p>
    <video controls width="640"><source src="{{src}}" type="video/webm">Your browser does not support WebM.</video>
  </div>
  {{/each}}
</section>
{{/if}}

<footer class="ship-readiness {{shipClass}}">
  <strong>Ship Readiness:</strong> {{shipReadiness}}
</footer>
</body>
</html>
