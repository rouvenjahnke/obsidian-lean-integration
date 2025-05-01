import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { LeanClient } from '../leanClient';
import { LeanGoal, TacticSuggestion } from '../types/lean-types';

interface TacticSuggestionsProps {
  leanClient: LeanClient;
  goal: LeanGoal;
  onApplyTactic: (tactic: string) => void;
}

export const TacticSuggestions = ({ 
  leanClient, 
  goal, 
  onApplyTactic 
}: TacticSuggestionsProps) => {
  const [tactics, setTactics] = useState<TacticSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (goal) {
      setLoading(true);
      leanClient.searchTactics(goal.uri, goal.goal)
        .then(results => {
          setTactics(results);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error searching tactics:', err);
          setLoading(false);
        });
    }
  }, [goal, leanClient]);

  // Filter tactics by name
  const filteredTactics = tactics.filter(tactic => 
    tactic.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Group tactics by success likelihood
  const groupedTactics = {
    high: filteredTactics.filter(t => t.success === 'high'),
    medium: filteredTactics.filter(t => t.success === 'medium'),
    low: filteredTactics.filter(t => t.success === 'low')
  };

  // Handle apply button click - insert the tactic
  const handleApplyTactic = (tactic: string) => {
    onApplyTactic(tactic);
  };

  return (
    <div className="lean-tactic-suggestions">
      <h4>Suggested Tactics</h4>
      
      <div className="lean-tactic-search">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tactics..."
          className="lean-tactic-search-input"
        />
      </div>
      
      {loading ? (
        <div className="lean-loading">Searching tactics...</div>
      ) : tactics.length > 0 ? (
        <div className="lean-tactic-groups">
          {groupedTactics.high.length > 0 && (
            <div className="lean-tactic-group lean-tactic-high">
              <h5>Recommended</h5>
              <ul className="lean-tactic-list">
                {groupedTactics.high.map((tactic, index) => (
                  <li key={`high-${index}`} className="lean-tactic-item">
                    <div className="lean-tactic-info">
                      <span className="lean-tactic-name">{tactic.name}</span>
                      <span className="lean-tactic-description">{tactic.description}</span>
                    </div>
                    <button 
                      className="lean-tactic-apply-button"
                      onClick={() => handleApplyTactic(tactic.name)}
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {groupedTactics.medium.length > 0 && (
            <div className="lean-tactic-group lean-tactic-medium">
              <h5>Worth Trying</h5>
              <ul className="lean-tactic-list">
                {groupedTactics.medium.map((tactic, index) => (
                  <li key={`medium-${index}`} className="lean-tactic-item">
                    <div className="lean-tactic-info">
                      <span className="lean-tactic-name">{tactic.name}</span>
                      <span className="lean-tactic-description">{tactic.description}</span>
                    </div>
                    <button 
                      className="lean-tactic-apply-button"
                      onClick={() => handleApplyTactic(tactic.name)}
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {groupedTactics.low.length > 0 && (
            <div className="lean-tactic-group lean-tactic-low">
              <h5>Other Options</h5>
              <ul className="lean-tactic-list">
                {groupedTactics.low.map((tactic, index) => (
                  <li key={`low-${index}`} className="lean-tactic-item">
                    <div className="lean-tactic-info">
                      <span className="lean-tactic-name">{tactic.name}</span>
                      <span className="lean-tactic-description">{tactic.description}</span>
                    </div>
                    <button 
                      className="lean-tactic-apply-button"
                      onClick={() => handleApplyTactic(tactic.name)}
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="lean-no-tactics">No tactics found for this goal</div>
      )}
      
      <div className="lean-tactic-custom">
        <textarea
          className="lean-tactic-custom-input"
          placeholder="Or enter a custom tactic..."
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const value = (e.target as HTMLTextAreaElement).value.trim();
              if (value) {
                handleApplyTactic(value);
                (e.target as HTMLTextAreaElement).value = '';
              }
            }
          }}
        />
      </div>
    </div>
  );
};

export default TacticSuggestions;