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
    console.log(`Account is not Banco Mifel: ${config.Account}`)
    return;
}
// Check that the amount is positive...
if (config.Amount < 0) {
    console.log(`Amount is negative. This is not a deposit: ${config.Amount}`)
    return;
}
// Check that the description corresponds to a Clip deposit to Mifel.
let regex = new RegExp(/SPEI\s([A-Z0-9]{9})\sGANAN/i);
let match = config.Description.match(regex);
if (!match || match.length != 2) {
    console.log(`No match or bad match for ${config.Description}`)
    return
}
let reference = match[1];

// Get Transaction table.
let table = base.getTable("Transactions");

// First we check that there isn't already a Clip debit transaction
// that matches (this makes the script idempotent).
let query = await table.selectRecordsAsync({fields: [table.getField("Account"), table.getField("Descripción")]});
let duplicate = query.records.find(record => (
    record.getCellValueAsString("Account") === "rec2Mk7a9iYcYg8f1" &&
    record.getCellValue("Descripción") === config.Description
));
if (duplicate) {
    console.log(`Found a duplicate for ${config.Description}`)
    return;
}

// Create a new Clip transaction record
let newRecordId = await table.createRecordAsync({
    Account: [{id: "rec2Mk7a9iYcYg8f1"}],
    Monto: -config.Amount,
    Fecha: config.Date,
    "Folio o referencia": reference,
    "Descripción": config.Description,
    "Created At": config.Date,
    // We link the Clip debit to the Mifel deposit.
    "Linked Transactions": [{id: config.recordID}]
});
if (!newRecordId) {
    throw new Error(`Failed to create new record for ${config.Description}`);
}

// Update the Mifel transaction to link to the new Clip transaction.
try {
    await table.updateRecordAsync(
        config.recordID,
        {"Linked Transactions": [{id: newRecordId}]}
    );
} catch (error) {
    throw new Error(`Failed to update Mifel transaction to link it to Clip: ${config.Description}: ${error.message}`);
}

}

run();
