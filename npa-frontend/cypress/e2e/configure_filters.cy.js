describe('Test 02: Configure Filters', () => {
  const API_TIMEOUT = 15000;
  const APP_NAME = 'acorn';

  beforeEach(() => {
    // Intercept the configuration data call
    cy.intercept('GET', `**/api/apps/configs?app_name=${APP_NAME}`).as('getConfigs');

    // 1. Set the session storage to skip the application selection page
    cy.window().then((win) => {
      win.sessionStorage.setItem('selectedApp', APP_NAME);
    });

    // 2. Visit the configuration page directly
    cy.visit(`http://localhost:3000/apps/${APP_NAME}/configs`);
    
    // Wait for the backend data to be loaded
    cy.wait('@getConfigs', { timeout: API_TIMEOUT });
  });

  it('should render all filters, allow interactions, reset and continue', () => {
    // GC Type & Heap selection
    cy.get('[data-testid="gc-selector-selector"]').select('s');
    cy.get('[data-testid="heap-capacity-select"]').select('512');

    // Select Radio Buttons by clicking the labels (more robust)
    cy.contains('Crash Detected').parent().contains('True').click();
    cy.contains('Failed').parent().contains('False').click();

    // CPU Active min/max
    cy.get('input[type="number"]').first().clear().type('2000');
    cy.get('input[type="number"]').last().clear().type('15000');

    // Prepare intercept for the NEXT page (Identify Issues)
    // FIX: The screenshot image_d95331.png shows the app calls /api/metrics/anomalies
    cy.intercept('GET', '**/api/metrics/anomalies?**').as('getAnomalies');

    // Select a specific run and Continue
    cy.get('select').last().select(1);
    cy.contains('Continue').click();

    // Verify navigation to the issues page
    cy.url().should('include', '/issues');

    // Verify backend data retrieval for the Identify Issues page
    // Using the correct alias based on the actual network call
    cy.wait('@getAnomalies', { timeout: API_TIMEOUT })
      .its('response.statusCode').should('eq', 200);

    // Final check: confirm the title of the next page is visible
    cy.contains('Identify Issues').should('be.visible');
  });
});