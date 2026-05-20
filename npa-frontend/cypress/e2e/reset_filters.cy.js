describe('Test 03: Reset Filters', () => {
  const API_TIMEOUT = 15000;
  const APP_NAME = 'acorn';

  beforeEach(() => {
    cy.intercept('GET', `**/api/apps/configs?app_name=${APP_NAME}`).as('getConfigs');

    cy.window().then((win) => {
      win.sessionStorage.setItem('selectedApp', APP_NAME);
    });

    cy.visit(`http://localhost:3000/apps/${APP_NAME}/configs`);
    cy.wait('@getConfigs', { timeout: API_TIMEOUT });
  });

  it('should clear all selected filters while keeping the app name and run list intact', () => {
    // 1. APPLY FILTERS
    cy.get('[data-testid="gc-selector-selector"]').select('s');
    
    // Select Radio Status by clicking the labels
    cy.contains('Crash Detected').parent().contains('True').click();
    cy.contains('Failed').parent().contains('False').click();

    cy.get('input[type="number"]').first().clear().type('5000');
    cy.get('select').last().select(1);

    // 2. CLICK RESET
    cy.contains('Reset Filters').click();

    // 3. VERIFY DEFAULTS (Technical fix for radio buttons)
    cy.contains(`Configure filters for ${APP_NAME}`).should('be.visible');

    // Verify Dropdowns
    cy.get('[data-testid="gc-selector-selector"]').should('have.value', '');

    // Verify Radio Status (Verify 'Any' is checked since state is reset to null)
    // We check that the radio next to "Any" is the one that is checked
    cy.contains('Crash Detected').parent().contains('Any').parent().find('input').should('be.checked');
    cy.contains('Failed').parent().contains('Any').parent().find('input').should('be.checked');

    // Verify CPU inputs
    cy.get('input[type="number"]').first().should('have.value', '');
    
    // Verify Runs dropdown is still populated
    cy.get('select').last().find('option').should('have.length.at.least', 2);
  });
});