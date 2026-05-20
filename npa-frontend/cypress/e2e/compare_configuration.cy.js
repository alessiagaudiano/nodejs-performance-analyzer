describe('Test 06: Compare Application Runs and Metrics', () => {
  const API_TIMEOUT = 15000;
  const LOAD_THRESHOLD = 5000; 
  const APP_NAME = 'acorn';

  beforeEach(() => {
    // Intercept main application list and app-specific configurations
    cy.intercept('GET', '**/api/apps').as('getApps');
    cy.intercept('GET', `**/api/apps/configs?app_name=${APP_NAME}`).as('getConfigs');
    cy.intercept('GET', '**/api/metrics/compare**').as('getComparison');

    cy.visit('http://localhost:3000/compare');
    
    // Ensure the initial application list is fetched
    cy.wait('@getApps', { timeout: API_TIMEOUT });
  });

  it('should load two runs, display KPIs and toggle between Split/Combined modes', () => {
    // 1. SELECT APPLICATION (Fix for disabled element error)
    cy.get('select').first()
      .should('not.be.disabled') // Wait for loadingApps state to be false
      .select(APP_NAME);
    
    cy.wait('@getConfigs', { timeout: API_TIMEOUT });

    // 2. SELECT TWO DIFFERENT RUNS
    // LEFT RUN selection
    cy.get('select').eq(1).should('not.be.disabled').select(0);
    // RIGHT RUN selection (different from left)
    cy.get('select').eq(2).should('not.be.disabled').select(5);

    // 3. PERFORMANCE AND KPI VERIFICATION (FR-11, FR-12)
    // Verify comparison boxes: Avg CPU, 95P GC PAUSE, PEAK HEAP_USED
    // Note: Using case-insensitive matching to be more robust
    cy.contains(/avg cpu/i).should('be.visible');
    cy.contains(/95p gc pause/i).should('be.visible');
    cy.contains(/peak heap[_\s]used/i).should('be.visible');

    // Verify the comparison arrows are present
    cy.contains(/avg cpu/i).parent().parent().should('contain', '→');

    // 4. VISUAL MODES: SPLIT vs COMBINED (FR-13, FR-14)
    // Verify initial Split Mode (side-by-side charts)
    cy.contains('Split').should('be.visible');
    
    // Verify we have side-by-side charts in split mode
    cy.get('.recharts-wrapper').should('have.length.at.least', 2);

    // Toggle to Combined Mode via the switch
    cy.get('input[type="checkbox"]').click({ force: true });
    
    // Verify Combined Mode overlay
    cy.contains('Combined').should('be.visible');
    
    // In Combined mode, check for overlaid lines in the legend
    cy.get('.recharts-legend-item').should('have.length.at.least', 2);

    // Toggle back to Split mode to verify it works both ways
    cy.get('input[type="checkbox"]').click({ force: true });
    cy.contains('Split').should('be.visible');

    // 5. RESPONSIVENESS (NFR-02)
    cy.get('div').contains('Loading').should('not.exist');
  });
});