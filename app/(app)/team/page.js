import { requireUser, ROLES } from '@/lib/auth';
import { teamMembers } from '@/lib/queries-v3';
import { updateMember } from '@/lib/actions-v3';
import PageHead from '@/components/PageHead';
import { MemberForm, ResetPasswordForm } from '@/components/forms-v3';

export const metadata = { title: 'الفريق | مُضيف' };

export default async function TeamPage() {
  const user = await requireUser(['owner']);
  const members = teamMembers(user.account_id);

  return (
    <div className="max-w-4xl">
      <PageHead title="الفريق" sub="أضف مديرين وعمال نظافة، كل واحد يدخل بحسابه ويشوف اللي يخصه بس." />

      <section className="mb-10">
        <div className="panel divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className={`flex flex-wrap items-start justify-between gap-4 p-4 ${m.active ? '' : 'opacity-60'}`}>
              <div>
                <p className="font-semibold">
                  {m.name}
                  {m.id === user.id && <span className="ms-2 text-xs text-muted">(أنت)</span>}
                  {!m.active && <span className="ms-2 rounded bg-line px-1.5 text-xs">موقوف</span>}
                </p>
                <p className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{m.email}</p>
                {m.phone && <p className="text-sm text-muted" dir="ltr" style={{ textAlign: 'right' }}>{m.phone}</p>}
              </div>
              {m.id === user.id ? (
                <span className="rounded bg-palm-soft px-2 py-0.5 text-sm text-palm-dark">{ROLES[m.role]}</span>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <form action={updateMember} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <div>
                      <label className="label text-xs" htmlFor={`role${m.id}`}>الصلاحية</label>
                      <select id={`role${m.id}`} name="role" defaultValue={m.role} className="field py-1.5 text-sm">
                        {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </div>
                    <button className="btn-ghost px-3 py-1.5 text-xs">حفظ</button>
                  </form>
                  <ResetPasswordForm id={m.id} />
                  <form action={updateMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="active" value={m.active ? '0' : '1'} />
                    <button className={`px-2 py-1.5 text-xs hover:underline ${m.active ? 'text-danger' : 'text-palm'}`}>{m.active ? 'إيقاف الحساب' : 'إعادة التفعيل'}</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3">عضو جديد</h2>
        <div className="panel p-5"><MemberForm /></div>
        <p className="mt-3 text-sm text-muted">
          بعد الإضافة أرسل له رابط المنصة والبريد وكلمة المرور. عامل النظافة يشوف صفحة المهام فقط، والمهام المسندة باسمه تظهر له مميزة.
        </p>
      </section>
    </div>
  );
}
