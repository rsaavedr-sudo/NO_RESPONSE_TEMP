def validate_columns(columns):
    """
    Validate mandatory columns.
    """
    mandatory = ['call_date', 'e164', 'sip_code']
    missing = [col for col in mandatory if col not in columns]
    return len(missing) == 0, missing
