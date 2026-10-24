"""Tournament-summary accounting. Monetary arithmetic stays in integer cents."""
import re
from datetime import datetime
from decimal import Decimal
from pathlib import Path

if __package__:
    from .hand_history_overview import build_hand_history_overview
else:
    from hand_history_overview import build_hand_history_overview

SUMMARY_DIR = Path(__file__).resolve().parent.parent / 'tournament_summaries'
MONEY = r'\$([\d,]+(?:\.\d{1,2})?)(?!\d|\.\d)'


def cents(value):
    amount = Decimal(value.replace(',', '')) * 100
    if amount != amount.to_integral_value():
        raise ValueError('Amount has fractional cents')
    return int(amount)


def parse_summary(text, source):
    text = text.lstrip('\ufeff')
    header = re.search(r'^(?:(PokerStars|Betfair) )?Tournament #(\d+),\s*(.+)', text, re.M)
    if not header:
        raise ValueError('No supported tournament-summary header')
    room = 'PokerStars / Betfair' if header[1] else 'GGPoker'
    hero = 'bullets685' if header[1] else 'Hero'
    warnings = []
    started = re.search(r'Tournament started (\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})', text)
    date = datetime.strptime(started[1], '%Y/%m/%d %H:%M:%S').isoformat() if started else None
    if date is None:
        warnings.append('Start time missing; omitted from the time-ordered graph.')
    row_pattern = (r'^\s*(\d+):\s*' + re.escape(hero) + r'(?:\s+\[(\d+)\])?\s+\([^\r\n]*?\),\s*([^\r\n]*)' if header[1]
                   else r'^\s*(\d+)(?:st|nd|rd|th)\s*:\s*' + re.escape(hero) + r',\s*([^\r\n]*)')
    row_pattern = row_pattern.replace(r'\s*', r'[ \t]*').replace(r'\s+', r'[ \t]+')
    rows = list(re.finditer(row_pattern, text, re.M))
    entered = bool(rows)
    finished = re.search(r'You finished(?: the tournament)? in (\d+)(?:st|nd|rd|th) place', text)
    hero_row = rows[0] if rows else None
    # In satellites, qualified players can be numbered alphabetically. Prefer
    # the explicit personal finish statement over the roster row number.
    place = int(finished[1]) if finished else int(hero_row[1]) if hero_row and 'still playing' not in hero_row[3 if header[1] else 2].lower() else None
    row_text = hero_row[3 if header[1] else 2].strip() if hero_row else ''
    terminal = entered and 'still playing' not in row_text.lower() and (bool(finished) or 'eliminated at hand' in text.lower() or 'Tournament finished' in text or bool(re.search(r'You received|received a total', text)))
    if not entered:
        warnings.append(f'No entry found for configured player {hero}; excluded from accounting.')
    buyin_match = re.search(r'^Buy-in:\s*([^\r\n]+)', text, re.I | re.M)
    unit = None
    if buyin_match:
        line = buyin_match[1].strip()
        parts = re.findall(MONEY, line)
        # Reject unsupported currency/payment text rather than interpreting a
        # prize-pool or target tournament amount as the entry cost.
        rest = re.sub(MONEY, '', line)
        if parts and not re.sub(r'[+/\s]|USD', '', rest, flags=re.I):
            unit = sum(cents(part) for part in parts)
    if unit is None:
        warnings.append('Buy-in missing or not supported in USD.')
    if not header[1]:
        warnings.append('GG dollar amounts are treated as USD; no currency code is supplied.')
    entries = max([int(row[2] or 1) for row in rows], default=0) if header[1] else (1 if entered else 0)
    reentries = re.search(r'You made (\d+) re-entries', text, re.I)
    if reentries and entered:
        entries = 1 + int(reentries[1])
    cost = unit * entries if entered and unit is not None else None
    cash = None
    qualified = 'qualified for the target tournament' in row_text.lower()
    ticket_award = qualified or 'ticket' in row_text.lower()
    if terminal:
        if ticket_award:
            cash = 0
            warnings.append('Noncash award excluded from cash returns.')
        elif header[1]:
            award = re.search(MONEY, row_text)
            cash = cents(award[1]) if award else 0 if not row_text else None
        else:
            award = re.search(r'(?:You received a total of|received a total of)\s*' + MONEY, text)
            cash = cents(award[1]) if award else None
    if entered and not terminal:
        warnings.append('Personal result is not final; excluded from completed-result accounting.')
    if entered and cash is None:
        warnings.append('Final cash return is unknown; it is not assumed to be zero.')
    bounty = 'bounty' in header[3].lower()
    # User's cash-based ITM: any positive cash return, including bounties.
    itm = cash > 0 if terminal and cash is not None else None
    return dict(id=header[2], room=room, name=header[3].strip(), hero=hero, entered=entered,
                started_at=date, timezone='CUST (unspecified)' if ' CUST' in text else 'unspecified',
                place=place, entries=entries, reentries=max(0, entries-1), unit_buyin_cents=unit,
                buyin_cents=cost, cash_return_cents=cash,
                itm=itm, final=terminal, bounty=bounty,
                warnings=warnings, source_files=[source], conflicted=False)


def build_tournaments(directory=SUMMARY_DIR):
    records = {}
    errors = []
    duplicates = 0
    files = sorted(directory.rglob('*.txt'))
    for path in files:
        source = str(path.relative_to(directory))
        try:
            row = parse_summary(path.read_text(encoding='utf-8-sig'), source)
        except (ValueError, OSError) as error:
            errors.append({'file': source, 'message': str(error)})
            continue
        key = (row['room'], row['id'])
        if key in records:
            duplicates += 1
            old = records[key]
            fields = ['entered', 'entries', 'buyin_cents', 'cash_return_cents', 'place', 'final', 'started_at', 'itm']
            if any(old[field] != row[field] for field in fields):
                old['conflicted'] = True
                old['warnings'].append('Duplicate summaries disagree; excluded from financial totals until reconciled.')
            old['source_files'].append(source)
        else:
            records[key] = row
    rows = sorted(records.values(), key=lambda row: (row['started_at'] or '9999', row['room'], row['id']))
    financial = []
    for row in rows:
        row['included'] = bool(row['entered'] and row['final'] and not row['conflicted'] and row['buyin_cents'] is not None and row['cash_return_cents'] is not None)
        row['profit_cents'] = row['cash_return_cents'] - row['buyin_cents'] if row['included'] else None
        if row['included']:
            financial.append(row)
    entrants = [row for row in rows if row['entered']]
    assessed_itm = [row for row in entrants if row['itm'] is not None and not row['conflicted']]
    costs = sum(row['buyin_cents'] for row in financial)
    returns = sum(row['cash_return_cents'] for row in financial)
    curve = []
    cumulative = 0
    for row in financial:
        if not row['started_at']:
            continue
        cumulative += row['profit_cents']
        curve.append({'id': row['id'], 'date': row['started_at'], 'profit_cents': row['profit_cents'], 'cumulative_cents': cumulative})
    pct = lambda a, b: round(100 * a / b, 2) if b else None
    crosscheck = None
    if directory == SUMMARY_DIR:
        histories = build_hand_history_overview()
        known = {(hand['room'], hand['tournament_id']) for hand in histories['hands'] if hand['tournament_id']}
        present = {(row['room'], row['id']) for row in entrants}
        crosscheck = {'known_history_tournaments': len(known), 'matched_summaries': len(known & present),
                      'missing_summaries': [{'room': room, 'id': tournament_id} for room, tournament_id in sorted(known - present)],
                      'history_parse_errors': len(histories['errors'])}
    return {
        'summary': {'tournaments': len(entrants), 'accounted_tournaments': len(financial),
                    'entries': sum(row['entries'] for row in entrants), 'reentries': sum(row['reentries'] for row in entrants),
                    'buyin_cents': costs, 'cash_return_cents': returns,
                    'net_profit_cents': returns-costs, 'roi_percent': pct(returns-costs, costs),
                    'itm_percent': pct(sum(row['itm'] for row in assessed_itm), len(assessed_itm)),
                    'itm_count': sum(row['itm'] for row in assessed_itm), 'itm_assessed': len(assessed_itm),
                    'itm_unknown': len(entrants)-len(assessed_itm), 'wins': sum(row['place'] == 1 for row in entrants if row['final'] and not row['conflicted'])},
        'quality': {'files_scanned': len(files), 'unique_summaries': len(rows), 'duplicates_removed': duplicates,
                    'conflicts': sum(row['conflicted'] for row in rows), 'parse_errors': len(errors),
                    'financial_coverage_percent': pct(len(financial), len(entrants)),
                    'excluded_tournaments': len(entrants)-len(financial),
                    'graph_excluded': sum(not row['started_at'] for row in financial)},
        'curve': curve, 'tournaments': rows, 'errors': errors, 'history_crosscheck': crosscheck,
        'methodology': [
            'Buy-ins include every listed fee/bounty component and one full buy-in per reported entry. Nominal buy-ins do not establish the payment method (cash, ticket or promotion).',
            'Cash returns use the personal total for GG and the configured player’s result row for PokerStars/Betfair. Noncash awards are ignored and recorded as $0 cash.',
            'Cash ROI = (cash returns − buy-ins) / buy-ins. No noncash award values are included.',
            'Cash-based ITM = completed tournaments with a positive cash return / completed tournaments with a known cash result. Bounty cash counts; noncash awards do not. This is a cash-return measure, not placement-only ITM.',
            'The graph orders tournaments by recorded start time, not settlement time. CUST and GG timezones are unspecified, so within-day cross-room ordering may be approximate.',
            'Coverage measures accounting completeness for these files, not evidence of long-run skill or a statistical confidence score. Missing files, extra costs or unrecorded awards cannot be ruled out.',
        ]}
