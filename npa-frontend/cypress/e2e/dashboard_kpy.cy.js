describe('Test 04: Dashboard overview and KPI’s & Recommendations', () => {
  const LOAD_THRESHOLD = 5000;
  const APP_NAME = 'acorn';
  const RUN_ID = '1764073962';

  beforeEach(() => {
    cy.intercept('GET', `**/api/apps/configs?app_name=${APP_NAME}`).as('getConfigs');
    cy.intercept('GET', '**/api/metrics/anomalies?**').as('getAnomalies');

    cy.window().then((win) => {
      win.sessionStorage.setItem('selectedApp', APP_NAME);
    });
    
    cy.visit(`http://localhost:3000/apps/${APP_NAME}/configs`);
    cy.wait('@getConfigs');
  });

  it('should display correct KPIs and validated Diagnostic Recommendations', () => {
    // Navigazione verso la dashboard
    cy.get('select').last().select(RUN_ID);
    cy.contains('Continue').click();

    // 1. Verifica Performance (NFR-03)
    cy.wait('@getAnomalies', { timeout: LOAD_THRESHOLD });

    // 2. Verifica KPI (FR-07)
    const kpiLabels = ['System Samples', 'High CPU Events', 'Long GC Pauses'];
    kpiLabels.forEach(label => {
      cy.contains(label).parent().find('.text-2xl').should('not.be.empty');
    });

    // 3. VERIFICA ANALITICA DELLE RACCOMANDAZIONI (US5)
    // Verifichiamo che la sezione Insights non sia vuota se ci sono messaggi
    cy.get('h3').contains('Diagnostic Insights').should('be.visible');

    // Analizziamo i singoli blocchi di insight
    cy.get('.grid.gap-3').find('.group').each(($el) => {
      // Estrarre il testo del messaggio (es. "High CPU usage detected")
      const messageText = $el.find('p').first().text();
      
      /* Logica Tecnica: Il codice React usa Object.keys(INSIGHT_ADVICE).find(...)
         Il test verifica che se il messaggio contiene una parola chiave, 
         il blocco "Recommendation" deve apparire e non essere vuoto.
      */
      if (messageText.includes("CPU") || messageText.includes("GC") || messageText.includes("heap")) {
        cy.wrap($el).within(() => {
          cy.contains('Recommendation:').should('be.visible');
          cy.get('p.text-xs').should('not.be.empty')
            .and(($p) => {
              // Verifica che il consiglio non sia solo il label ma contenga testo utile
              expect($p.text().length).to.be.greaterThan(20);
            });
        });
      }
    });

    // 4. Verifica Correttezza Badge Criticità (FR-08)
    cy.get('span').contains('System Status').parent().find('.text-xl').then(($status) => {
      const status = $status.text();
      // Il colore deve corrispondere allo stato (es. Red per Critical)
      if (status === 'Critical') {
        cy.wrap($status).should('have.css', 'color', 'rgb(239, 68, 68)');
      } else if (status === 'Warning') {
        cy.wrap($status).should('have.css', 'color', 'rgb(245, 158, 11)');
      }
    });
  });
});