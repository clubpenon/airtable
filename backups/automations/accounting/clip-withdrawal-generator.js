// This script detects changes to Mifel recorded transactions.
// If a transaction is a deposit from Clip, then it will create
// a correspondig Clip transaction debit because Clip doesn't
// provide those, and we want Clip to be handled like a regular
// account with a balance.

// Create a function so we can "return".
async function run() {

    // Get the fields data from the row that seems to match a Clip deposit.
    let config = input.config();

    // We start by checking that all the conditions are met.
    // This is in case the previous step in the automation is modified
    // and the condition for running this script becomes loose...

    // Check that the account is Mifel.
    if (config.Account.toString() != "recg7AZx1tbxx1drT") {
        throw new Error(`Account is ${config.Account}, expected recg7AZx1tbxx1drT (Banco Mifel)`);
    }
    // Check that the amount is positive...
    if (config.Amount < 0) {
        throw new Error(`Amount is ${config.Amount}, expected a positive value (deposit)`);
    }
    // Check that the description corresponds to a Clip deposit to Mifel.
    let regex = new RegExp(/SPEI\s+([A-Z0-9]{9})\s+GANAN/i);
    let match = config.Description.match(regex);
    if (!match || match.length != 2) {
        throw new Error(`Description "${config.Description}" does not match expected Clip deposit pattern`);
    }
    let reference = match[1];

    // Get Transaction table.
    let table = base.getTable("Transactions");

    // First we check that there isn't already a Clip debit transaction
    // that matches (this makes the script idempotent).
    let query = await table.selectRecordsAsync({ fields: [table.getField("Account"), table.getField("Descripción")] });
    let duplicate = query.records.find(record => (
        record.getCellValueAsString("Account") === "rec2Mk7a9iYcYg8f1" &&
        record.getCellValue("Descripción") === config.Description
    ));
    if (duplicate) {
        throw new Error(`Found a duplicate Clip debit for "${config.Description}"`);
    }

    // Create a new Clip transaction record
    let newRecordId = await table.createRecordAsync({
        Account: [{ id: "rec2Mk7a9iYcYg8f1" }],
        Monto: -config.Amount,
        Fecha: config.Date,
        "Categoría": [{ id: "recFjedar54luEzN4" }], // Internal Transaction category.
        "Folio o referencia": reference,
        "Descripción": config.Description,
        "Created At": config.Date,
        // We link the Clip debit to the Mifel deposit.
        "Linked Transactions": [{ id: config.recordID }]
    });
    if (!newRecordId) {
        throw new Error(`Failed to create new record for ${config.Description}`);
    }

    // Update the Mifel transaction to link to the new Clip transaction.
    // Not strictly necessary because the internal transaction linker automation does this automatically.
    // But we want to make sure the link is created even if that automation is not running for some reason.
    try {
        await table.updateRecordAsync(
            config.recordID,
            {
                "Categoría": [{ id: "recFjedar54luEzN4" }], // Internal Transaction category.
                "Linked Transactions": [{ id: newRecordId }]
            }
        );
    } catch (error) {
        throw new Error(`Failed to update Mifel transaction to link it to Clip: ${config.Description}: ${error.message}`);
    }

    console.log(`Successfully created Clip debit transaction with ID ${newRecordId} linked to Mifel deposit with ID ${config.recordID}.`);
}

run();
