import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

const FAQS = [
  {
    q: 'How do I create an Activity?',
    a: 'Go to Activities → New activity. Enter the activity details, then continue to Participants and Check & Submit.',
  },
  {
    q: 'How do I upload participants?',
    a: 'On the Participants step, download the Participant List template, fill it in Excel, then upload it. AMS matches or creates People from the rows.',
  },
  {
    q: 'How do I check compliance?',
    a: 'Open Compliance from the sidebar, or use Check & Submit when registering. Warnings appear before you submit.',
  },
  {
    q: 'How do I submit an Accountability?',
    a: 'Open Accountability → create or open a case linked to an activity → add expenditure lines and supporting documents → Submit. An activity report is not the same as an accountability.',
  },
  {
    q: 'What does 120 days mean?',
    a: 'An early warning when a person reaches 120 annual field days and is approaching the 150-day annual threshold.',
  },
  {
    q: 'What does 150 days mean?',
    a: 'The annual field-day threshold. At exactly 150 days the person has reached the limit; above 150 the limit is exceeded.',
  },
  {
    q: 'What does an overlap warning mean?',
    a: 'The same person appears on two activities whose dates overlap. AMS warns you so you can review — it does not block submission automatically.',
  },
  {
    q: 'How do I find my notifications?',
    a: 'Use the bell icon in the top bar. Open a notification to go to the related activity, person, or accountability. Mark all as read when you have reviewed them.',
  },
  {
    q: 'How do I change my password?',
    a: 'Open More → My profile → Change password. Enter your current password, then the new password twice. Use Show/Hide if you need to check what you typed.',
  },
  {
    q: 'What is my role?',
    a: 'Your role appears on My profile. Officers do operational work. Reviewers review cases. Administrators manage users and system tools.',
  },
  {
    q: 'Why can\'t I access a page?',
    a: 'Your role may not include that function. Contact an administrator if you believe you need access.',
  },
  {
    q: 'Who can create users?',
    a: 'Only Administrators, under More → Administration → Users.',
  },
  {
    q: 'Who can change roles?',
    a: 'Only Administrators. Role changes take effect on the user\'s next signed-in request.',
  },
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="Short answers for everyday AMS work." />
      <div className="space-y-4">
        {FAQS.map((item) => (
          <details key={item.q} className="rounded-lg bg-white px-4 py-3 shadow-ams">
            <summary className="cursor-pointer text-sm font-semibold text-ink-900">{item.q}</summary>
            <p className="mt-2 text-sm text-ink-700">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-500">
        Activity report and Accountability are separate. Submitting an activity report does not approve an accountability case.
      </p>
      <Link to="/" className="ams-btn-primary mt-4 inline-flex">
        Return to Home
      </Link>
    </div>
  );
}
