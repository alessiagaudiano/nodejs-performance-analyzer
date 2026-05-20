describe('Test 05: Explore Performance Metrics', () => {
  const API_TIMEOUT = 15000;
  const LOAD_THRESHOLD = 5000; 
  const APP_NAME = 'acorn';
  const RUN_ID = '1764073962';

  // REAL TIMESTAMPS extracted from your chart images
  const START_TS = '1764073962862'; 
  const END_TS = '1764073969296';

  beforeEach(() => {
    // Maintain app context
    cy.window().then((win) => {
      win.sessionStorage.setItem('selectedApp', APP_NAME);
    });
    
    // Navigation workflow
    cy.visit(`http://localhost:3000/apps/${APP_NAME}/configs`);
    cy.get('select').last().select(RUN_ID);
    cy.contains('Continue').click();
    
    cy.wait(2000); // Wait for anomalies to load
    cy.contains('View Detailed Metrics').click();

    // Wait for page to load
    cy.contains('h3', 'Memory Usage', { timeout: API_TIMEOUT }).should('be.visible');
  });

  it('should validate chart rendering and zooming using real data points', () => {
    // 1. CHART RENDERING VERIFICATION
    cy.contains('h3', 'Memory Usage').should('be.visible');
    cy.get('.recharts-surface').should('have.length.at.least', 3);

    // 2. ZOOM VIA REAL TIMESTAMPS
    // Set up the intercept BEFORE clicking Apply
    cy.intercept('GET', '**/api/metrics/memory-usage**').as('getMemoryFiltered');

    cy.contains('h3', 'Memory Usage').parents('.card').within(() => {
      cy.get('input[placeholder="Start (ms)"]').clear().type(START_TS);
      cy.get('input[placeholder="End (ms)"]').clear().type(END_TS);
      cy.contains('Apply').click();
    });

    // NOW wait for the filtered API request
    cy.wait('@getMemoryFiltered', { timeout: API_TIMEOUT }).then((interception) => {
      const url = interception.request.url;
      // Validating that the parameters are correctly appended to the query string
      expect(url).to.contain(`start_ts=${START_TS}`);
      expect(url).to.contain(`end_ts=${END_TS}`);
    });

    // Verify "No data available" is NOT shown after a valid zoom
    cy.contains('No data available').should('not.exist');

    // 3. FILTERS RESET TEST
    cy.intercept('GET', '**/api/metrics/memory-usage**').as('getMemoryReset');
    
    cy.contains('h3', 'Memory Usage').parents('.card').within(() => {
      cy.contains('Reset').click();
      cy.get('input[placeholder="Start (ms)"]').should('have.value', '');
    });

    // Confirm the default dataset reloads (without start_ts/end_ts)
    cy.wait('@getMemoryReset', { timeout: API_TIMEOUT }).then((interception) => {
      const url = interception.request.url;
      expect(url).to.not.contain('start_ts');
      expect(url).to.not.contain('end_ts');
    });

    // 4. PAGINATION VERIFICATION
    cy.contains(/Page \d+ of \d+/).should('be.visible');
  });
});